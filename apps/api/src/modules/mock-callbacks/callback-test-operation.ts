import { type AnyOperation, defineOperation } from "@localman/operations";
import type { JsonObject } from "@localman/shared";
import type { HeaderEntry } from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	createProxyConcurrency,
	proxyBusy,
} from "../api-client/proxy-concurrency.js";
import { encodeBody } from "../api-client/proxy-response-body.js";
import { storedPlanOf } from "../billing/plan-guard.js";
import { requireProject } from "../projects/project-service.js";
import {
	RecordModel,
	type StoredRecord,
	toRecordView,
} from "../resources/record-model.js";
import { loadResources, parentKeyIn } from "../resources/resource-store.js";
import {
	type CallbackInput,
	callbackInputSchema,
	checkedTarget,
} from "./callback-config.js";
import { keepHiddenValues } from "./callback-headers.js";
import { recordCallbackLine, renderCallback } from "./callback-message.js";
import {
	CallbackConfigModel,
	type StoredCallbackConfig,
} from "./callback-model.js";
import { requireCallbackResource } from "./callback-view.js";
import { deliveryView, toDeliveryView } from "./delivery-view.js";
import {
	type DeliveryResult,
	type OutboundDeps,
	deliverNow,
	deliveryOf,
} from "./outbound-send.js";
import { targetLabel } from "./outbound-target.js";

/** Deadline of one test attempt: the dialog waits for all of them. */
export const TEST_ATTEMPT_TIMEOUT_MS = 10_000;
/** Test sends in flight per account and in the process. */
export const TEST_CONCURRENCY = { perUser: 2, total: 16 } as const;

const TEST_EXEMPT =
	"gửi bản ghi của project tới đích lấy từ input (URL https hay tunnel của owner); agent bị prompt injection không được dùng nó để chuyển dữ liệu đi chỗ khác, nên chỉ user gửi thử từ giao diện";

/** The resource's first record as the mock shows it, else `{ "id": "1" }`. */
async function sampleRecord(
	projectId: Types.ObjectId,
	resourceId: Types.ObjectId,
): Promise<JsonObject> {
	const record = await RecordModel.findOne({ resourceId })
		.sort({ _id: 1 })
		.lean<StoredRecord>();
	if (!record) return { id: "1" };
	const resources = await loadResources(projectId);
	const resource = resources.find((r) => r._id.equals(resourceId));
	return toRecordView(
		record,
		resource ? parentKeyIn(resources, resource) : null,
	);
}

const testOutput = z.object({
	target: z.string(),
	delivery: deliveryView,
	/** The last answer, if one came (body cut at 64 KB). */
	response: z
		.object({
			status: z.number(),
			body: z.string(),
			bodyEncoding: z.enum(["utf8", "base64"]),
			truncated: z.boolean(),
		})
		.nullable(),
});

function responseOf(
	result: DeliveryResult,
): z.infer<typeof testOutput>["response"] {
	const { response } = result;
	if (!response) return null;
	const encoded = encodeBody(response.body, response.truncated);
	return {
		status: response.status,
		body: encoded.body,
		bodyEncoding: encoded.bodyEncoding,
		truncated: response.truncated,
	};
}

/** Header values of a saved callback (by `id`) the draft sends as `[hidden]`. */
async function draftHeaders(
	resourceId: Types.ObjectId,
	callback: CallbackInput,
): Promise<HeaderEntry[]> {
	const config = callback.id
		? await CallbackConfigModel.findOne({ resourceId })
				.select("callbacks")
				.lean<Pick<StoredCallbackConfig, "callbacks">>()
		: null;
	const saved = config?.callbacks.find((stored) => stored.id === callback.id);
	return keepHiddenValues(callback.headers, saved?.headers ?? []);
}

/** "Send test": the callback draft rendered with a sample record, sent now. */
export function createTestCallbackOperation(deps: OutboundDeps): AnyOperation {
	const concurrency = createProxyConcurrency(TEST_CONCURRENCY);
	const testDeps: OutboundDeps = {
		...deps,
		timeoutMs: Math.min(deps.timeoutMs, TEST_ATTEMPT_TIMEOUT_MS),
	};
	return defineOperation({
		id: "traffic.testResourceCallback",
		method: "POST",
		path: "/projects/:projectId/resources/:resourceId/callbacks/test",
		summary: "Send a test request of a mock callback",
		description: `Owner only (collaborators get 403). Renders the given callback (saved or not; a header value of [hidden] takes the saved value, as on save) with the resource's first record ({"id":"1"} when empty) and its own event, sends it now with up to 3 attempts (1 s, then 4 s apart; ${TEST_ATTEMPT_TIMEOUT_MS / 1000} s each) and answers the delivery (ok, status, attempts) and the last response. The target is checked like on save. Logged as a callback line. At most ${TEST_CONCURRENCY.perUser} tests of an account run at once (429 PROXY_BUSY).`,
		input: z.object({
			projectId: z.string().min(1).max(64),
			resourceId: z.string().min(1).max(64),
			callback: callbackInputSchema,
		}),
		output: testOutput,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: false },
		toolset: "traffic",
		mcp: { exempt: TEST_EXEMPT },
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "update", input.projectId);
			const resource = await requireCallbackResource(
				project._id,
				input.resourceId,
			);
			const { callback } = input;
			const target = await checkedTarget(
				sub,
				"callback.target.url",
				callback.target,
				deps.guard,
			);
			const slot = concurrency.acquire(sub);
			if (!slot.ok) throw await proxyBusy(sub, slot.scope, concurrency.limits);
			try {
				const record = await sampleRecord(project._id, resource._id);
				const context = { event: callback.on, resource: resource.name, record };
				const headers = await draftHeaders(resource._id, callback);
				const rendered = renderCallback(
					{ ...callback, target, headers },
					context,
				);
				const at = new Date();
				const result: DeliveryResult = rendered.failure
					? {
							attempts: [{ at, error: rendered.failure, ms: 0 }],
							response: null,
						}
					: await deliverNow(
							rendered.message,
							project.owner,
							testDeps,
							ctx.signal,
						);
				const owner = {
					id: project._id,
					owner: project.owner,
					ownerPlan: await storedPlanOf(project.owner),
					redactHeaders: project.redactHeaders ?? [],
				};
				recordCallbackLine(owner, at, callback.on, rendered.message, result);
				const delivery = toDeliveryView(deliveryOf(result));
				if (!delivery) throw new Error("A delivery always has a time");
				return {
					target: targetLabel(target),
					delivery,
					response: responseOf(result),
				};
			} finally {
				slot.release();
			}
		},
	});
}
