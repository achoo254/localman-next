import {
	type AnyOperation,
	OperationError,
	defineOperation,
} from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { messagesFor } from "../../i18n/server-messages.js";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";
import { effectivePlan, storedPlanOf } from "../billing/plan-guard.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "../projects/project-model.js";
import { requireProject } from "../projects/project-service.js";
import { readUserLocale } from "../users/user-locale.js";
import { DEFAULT_REDACTED_HEADERS, logDaysOf } from "./request-log-entry.js";
import { forgetMockProject } from "./resolve-project.js";
import {
	type ProjectUpstream,
	normalizeBaseUrl,
	normalizeRedactHeaders,
	redactHeadersSchema,
	upstreamOf,
	upstreamSchema,
} from "./upstream-config.js";
import { ownerTunnelUrl } from "./upstream-target.js";

const projectId = z.string().min(1).max(64);

const settingsView = z.object({
	upstream: upstreamSchema,
	/** Tunnel upstream: the owner's enabled tunnel URL of the port, if mapped. */
	tunnelUrl: z.string().nullable(),
	redactHeaders: z.array(z.string()),
	defaultRedactedHeaders: z.array(z.string()),
	/** The owner's effective plan and the days a line written now is kept. */
	plan: z.enum(["free", "pro"]),
	logDays: z.number(),
	/** The caller may change the upstream and masked headers (owner only). */
	canManage: z.boolean(),
});

async function viewOf(project: StoredProject, sub: string) {
	const upstream = upstreamOf(project.upstream);
	const now = new Date();
	const ownerPlan = await storedPlanOf(project.owner);
	return {
		upstream,
		tunnelUrl:
			upstream.kind === "tunnel"
				? await ownerTunnelUrl(project.owner, upstream.port)
				: null,
		redactHeaders: [...(project.redactHeaders ?? [])],
		defaultRedactedHeaders: [...DEFAULT_REDACTED_HEADERS],
		plan: effectivePlan(ownerPlan, now),
		logDays: logDaysOf(ownerPlan, now),
		canManage: project.owner === sub,
	};
}

async function save(
	project: StoredProject,
	change: Record<string, unknown>,
): Promise<StoredProject> {
	const updated = await ProjectModel.findOneAndUpdate(
		{ _id: project._id, ...LIVE_PROJECT },
		change,
		{ returnDocument: "after" },
	).lean<StoredProject>();
	if (!updated) throw new OperationError(404, "NOT_FOUND", "Project not found");
	// The runtime caches projects for 60 s: apply the change now.
	forgetMockProject(updated.secret);
	return updated;
}

/** The base URL as stored, after the shape check and the SSRF guard. */
async function checkedBaseUrl(
	sub: string,
	input: string,
	guard: SsrfGuard,
): Promise<string> {
	const texts = messagesFor(await readUserLocale(sub)).traffic;
	const baseUrl = normalizeBaseUrl(input);
	if (baseUrl === null) {
		throw new OperationError(400, "VALIDATION_ERROR", texts.baseUrlInvalid, [
			{ path: "upstream.baseUrl", message: texts.baseUrlInvalid },
		]);
	}
	try {
		await guard.pin(new URL(baseUrl));
	} catch (error) {
		if (!(error instanceof OperationError)) throw error;
		if (error.code === "PROXY_DNS_FAILED") {
			throw new OperationError(400, "UPSTREAM_DNS_FAILED", texts.baseUrlDns);
		}
		throw new OperationError(400, "UPSTREAM_URL_BLOCKED", texts.baseUrlBlocked);
	}
	return baseUrl;
}

const UPSTREAM_EXEMPT =
	"đổi nơi mock chuyển tiếp request của người gọi (kèm Authorization, cookie) sang URL hay tunnel khác; agent bị prompt injection không được chuyển credential đi chỗ khác, nên chỉ user đổi từ giao diện";

const REDACT_EXEMPT =
	"bỏ che header trong log request; agent bị prompt injection có thể gỡ tên header bí mật khỏi danh sách rồi đọc giá trị thật của các request sau qua get_request_log, nên chỉ user đổi từ giao diện";

/** Traffic settings of a project; the guard checks an upstream URL's host. */
export function createTrafficSettingsOperations(
	guard: SsrfGuard,
): AnyOperation[] {
	const getTrafficSettings = defineOperation({
		id: "traffic.getTrafficSettings",
		method: "GET",
		path: "/projects/:projectId/traffic-settings",
		summary: "Get a mock project's upstream and request log settings",
		description:
			"Hybrid mock upstream (none, tunnel of the owner's localhost:<port>, or an https base URL) with tunnelUrl (the owner's enabled tunnel URL of that port; null when unmapped or not a tunnel), the extra header names masked in the request log, the headers always masked, the owner's plan and logDays (how long new log lines are kept), and canManage (only the owner changes these settings). Members of the project only (404 otherwise).",
		input: z.object({ projectId }),
		output: settingsView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: true,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			return viewOf(await requireProject(sub, "read", input.projectId), sub);
		},
	});

	const setProjectUpstream = defineOperation({
		id: "traffic.setProjectUpstream",
		method: "PUT",
		path: "/projects/:projectId/upstream",
		summary: "Set where a hybrid mock forwards unmatched requests",
		description:
			"Owner only (collaborators get 403). `none` turns forwarding off; `tunnel` forwards to the URL the owner mapped to localhost:<port> in the API client settings; `url` to an https base URL (no credentials, query or fragment, not a mock URL: 400 VALIDATION_ERROR; private, loopback or the server's own addresses: 400 UPSTREAM_URL_BLOCKED; unresolvable host: 400 UPSTREAM_DNS_FAILED).",
		input: z.object({ projectId, upstream: upstreamSchema }),
		output: settingsView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: { exempt: UPSTREAM_EXEMPT },
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "update", input.projectId);
			let upstream: ProjectUpstream = input.upstream;
			if (upstream.kind === "url") {
				const baseUrl = await checkedBaseUrl(sub, upstream.baseUrl, guard);
				upstream = { kind: "url", baseUrl };
			}
			const change =
				upstream.kind === "none"
					? { $unset: { upstream: 1 } }
					: { $set: { upstream } };
			return viewOf(await save(project, change), sub);
		},
	});

	const setRedactHeaders = defineOperation({
		id: "traffic.setRedactHeaders",
		method: "PUT",
		path: "/projects/:projectId/redact-headers",
		summary: "Set the extra headers masked in a project's request log",
		description: `Owner only (collaborators get 403). Replaces the project's extra masked header names (case-insensitive, at most 50) on top of ${DEFAULT_REDACTED_HEADERS.join(", ")}, which are always masked. Applies to lines written from now on.`,
		input: z.object({ projectId, headers: redactHeadersSchema }),
		output: settingsView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: { exempt: REDACT_EXEMPT },
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "update", input.projectId);
			const headers = normalizeRedactHeaders(input.headers);
			return viewOf(
				await save(project, { $set: { redactHeaders: headers } }),
				sub,
			);
		},
	});

	return [getTrafficSettings, setProjectUpstream, setRedactHeaders];
}
