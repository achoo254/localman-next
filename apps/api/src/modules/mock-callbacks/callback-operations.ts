import {
	type AnyOperation,
	OperationError,
	defineOperation,
} from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { inProjectTransaction } from "../projects/project-lock.js";
import { requireProject } from "../projects/project-service.js";
import { ResourceModel } from "../resources/resource-model.js";
import {
	DEFAULT_BODY_TEMPLATE,
	MAX_CALLBACKS_PER_RESOURCE,
	callbacksInputSchema,
	toStoredCallbacks,
} from "./callback-config.js";
import {
	HIDDEN_HEADER_VALUE,
	revealsHeaderValues,
} from "./callback-headers.js";
import {
	CallbackConfigModel,
	type StoredCallbackConfig,
} from "./callback-model.js";
import { createTestCallbackOperation } from "./callback-test-operation.js";
import {
	callbackView,
	requireCallbackResource,
	toCallbackView,
} from "./callback-view.js";
import { type OutboundDeps, defaultOutboundDeps } from "./outbound-send.js";

const ids = {
	projectId: z.string().min(1).max(64),
	resourceId: z.string().min(1).max(64),
};
const PATH = "/projects/:projectId/resources/:resourceId/callbacks";

const callbacksOutput = z.object({
	callbacks: z.array(callbackView),
	max: z.number(),
	defaultBodyTemplate: z.string(),
	/** The caller may change them and send tests (owner only). */
	canManage: z.boolean(),
});

const CALLBACKS_EXEMPT =
	"đổi nơi mock gửi bản ghi ra ngoài (URL https hay tunnel của owner, kèm header tuỳ chỉnh); agent bị prompt injection không được chuyển dữ liệu đi chỗ khác, nên chỉ user đổi từ giao diện";

function outputOf(
	config: StoredCallbackConfig | null,
	canManage: boolean,
	reveal: boolean,
): z.infer<typeof callbacksOutput> {
	return {
		callbacks: (config?.callbacks ?? []).map((callback) =>
			toCallbackView(callback, reveal),
		),
		max: MAX_CALLBACKS_PER_RESOURCE,
		defaultBodyTemplate: DEFAULT_BODY_TEMPLATE,
		canManage,
	};
}

/** Mock callback operations; tests pass their own guard and tunnels. */
export function createCallbackOperations(deps: OutboundDeps): AnyOperation[] {
	const getResourceCallbacks = defineOperation({
		id: "traffic.getResourceCallbacks",
		method: "GET",
		path: PATH,
		summary: "Get the mock callbacks of a resource",
		description: `Requests the mock sends when a record of the resource is created, updated or deleted through the mock runtime (REST or Hosted Mock MCP; dashboard edits send none). Each callback has on (create, update, delete), target ({kind:url,url} or {kind:tunnel,port,path}, the owner's tunnel of localhost:<port>), bodyTemplate ({{record}}, {{record.<field>}}, {{event}}, {{resource}}), headers, enabled and last (the latest delivery with its attempts). Header values and a target URL's query may be secrets: only the owner reads them, in the dashboard; members and every MCP call get ${HIDDEN_HEADER_VALUE} with hidden: true for header values, and the URL as origin and path followed by ?${HIDDEN_HEADER_VALUE} (in target and targetLabel). Members of the project only.`,
		input: z.object(ids),
		output: callbacksOutput,
		scopes: [USER_SCOPE],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: true,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "read", input.projectId);
			const resource = await requireCallbackResource(
				project._id,
				input.resourceId,
			);
			const config = await CallbackConfigModel.findOne({
				resourceId: resource._id,
			}).lean<StoredCallbackConfig>();
			const isOwner = project.owner === sub;
			return outputOf(config, isOwner, revealsHeaderValues(ctx, isOwner));
		},
	});

	const setResourceCallbacks = defineOperation({
		id: "traffic.setResourceCallbacks",
		method: "PUT",
		path: PATH,
		summary: "Replace the mock callbacks of a resource",
		description: `Owner only (collaborators get 403). Replaces the resource's callbacks (at most ${MAX_CALLBACKS_PER_RESOURCE}). Each: id (keep it to keep the last result; new callbacks get one), on, target (an https URL without credentials or fragment that is not a mock URL, checked against private addresses now: 400 VALIDATION_ERROR, CALLBACK_URL_BLOCKED, CALLBACK_DNS_FAILED; or tunnel:<port><path>), bodyTemplate up to 64 KB, headers (at most 20; hop-by-hop, Host, Content-Length and X-Localman-* are refused; a value of ${HIDDEN_HEADER_VALUE} keeps the stored value of the same-named header of that callback id; likewise a URL sent back as origin and path with the query ?${HIDDEN_HEADER_VALUE} keeps the stored query when the origin and path are unchanged) and enabled. Sent as POST with Content-Type: application/json unless a header sets it, in the background, retried up to 3 times (1 s, then 4 s apart); results go to the request log with source callback.`,
		input: z.object({ ...ids, callbacks: callbacksInputSchema }),
		output: callbacksOutput,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: { exempt: CALLBACKS_EXEMPT },
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "update", input.projectId);
			const resource = await requireCallbackResource(
				project._id,
				input.resourceId,
			);
			const previous = await CallbackConfigModel.findOne({
				resourceId: resource._id,
			}).lean<StoredCallbackConfig>();
			const callbacks = await toStoredCallbacks(
				sub,
				input.callbacks,
				previous?.callbacks ?? [],
				deps.guard,
			);
			// Under the tree lock: a resource deleted meanwhile either takes
			// these callbacks with it or makes this write fail with 404.
			const config = await inProjectTransaction(
				project._id,
				async (session) => {
					const live = await ResourceModel.exists({
						_id: resource._id,
						projectId: project._id,
					}).session(session);
					if (!live) {
						throw new OperationError(404, "NOT_FOUND", "Resource not found");
					}
					return CallbackConfigModel.findOneAndUpdate(
						{ resourceId: resource._id },
						{ $set: { projectId: project._id, callbacks } },
						{ upsert: true, returnDocument: "after", session },
					).lean<StoredCallbackConfig>();
				},
			);
			return outputOf(config, true, revealsHeaderValues(ctx, true));
		},
	});

	return [
		getResourceCallbacks,
		setResourceCallbacks,
		createTestCallbackOperation(deps),
	];
}

/** The callback operations of the registry (runtime guard, owner tunnels). */
export const callbackOperations: AnyOperation[] = createCallbackOperations(
	defaultOutboundDeps(),
);
