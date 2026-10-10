import {
	type AnyOperation,
	OperationError,
	defineOperation,
} from "@localman/operations";
import { apiRequestDraftSchema } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	type ProxyConcurrency,
	createProxyConcurrency,
	proxyBusy,
} from "../api-client/proxy-concurrency.js";
import { requireProject } from "../projects/project-service.js";
import {
	type ReplayDeps,
	defaultReplayDeps,
	replayLogLine,
} from "./replay-service.js";
import { draftOfLogLine } from "./request-log-draft.js";
import { requestLogOperations } from "./request-log-operations.js";
import { requireLogLine } from "./request-log-store.js";
import { createTrafficSettingsOperations } from "./traffic-settings-operations.js";

const projectId = z.string().min(1).max(64);
const logId = z.string().min(1).max(64);

/** Replays in flight per account and in the process. */
export const REPLAY_CONCURRENCY = { perUser: 2, total: 16 } as const;

const replayOutput = z.object({
	status: z.number(),
	headers: z.array(z.object({ name: z.string(), value: z.string() })),
	body: z.string(),
	bodyEncoding: z.enum(["utf8", "base64"]),
	size: z.number(),
	truncated: z.boolean(),
	ms: z.number(),
	source: z.string().nullable(),
});

/** Every `traffic` operation; tests pass their own guard and mock origin. */
export function createTrafficOperations(
	deps: ReplayDeps,
	concurrency: ProxyConcurrency = createProxyConcurrency(REPLAY_CONCURRENCY),
): AnyOperation[] {
	const replayRequestLog = defineOperation({
		id: "traffic.replayRequestLog",
		method: "POST",
		path: "/projects/:projectId/request-logs/:logId/replay",
		summary: "Send a logged request to the mock again",
		description: `Sends the logged method, path, query, headers and body to the project's mock URL again, through the real mock runtime: it counts toward the owner's monthly mock requests, may go to the upstream of a hybrid mock, and appears as a new log line. Masked headers are not sent; callback lines (requests the mock sent out) answer 409 REPLAY_NOT_SUPPORTED. Returns the answer (status, headers, body as UTF-8 text or base64, ms, source from X-Localman-Source). A body cut at 64 KB in the log answers 409 REPLAY_BODY_TRUNCATED; no answer from the mock 502 REPLAY_FAILED; at most ${REPLAY_CONCURRENCY.perUser} replays of an account run at once (429 PROXY_BUSY). Members of the project only.`,
		input: z.object({ projectId, logId }),
		output: replayOutput,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: false },
		toolset: "traffic",
		mcp: true,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "read", input.projectId);
			const line = await requireLogLine(project._id, input.logId);
			if (line.source === "callback") {
				// A callback went out of the mock; there is nothing to send to it.
				throw new OperationError(
					409,
					"REPLAY_NOT_SUPPORTED",
					"Callback lines cannot be replayed",
				);
			}
			const slot = concurrency.acquire(sub);
			if (!slot.ok) throw await proxyBusy(sub, slot.scope, concurrency.limits);
			try {
				return await replayLogLine(sub, line, project.secret, deps, ctx.signal);
			} finally {
				slot.release();
			}
		},
	});

	const getRequestLogDraft = defineOperation({
		id: "traffic.getRequestLogDraft",
		method: "GET",
		path: "/projects/:projectId/request-logs/:logId/draft",
		summary: "Turn a logged request into an API client request",
		description:
			'"Open in API client": a request draft (the API client tab model) of the logged request with the mock URL, path and query (params mirror it), the client\'s headers (masked ones as empty disabled rows to fill in) and the body as raw text or url-encoded rows; binary bodies and bodies cut at 64 KB are left out. Callback lines (requests the mock sent out) answer 409 DRAFT_NOT_SUPPORTED. Members of the project only.',
		input: z.object({ projectId, logId }),
		output: z.object({ draft: apiRequestDraftSchema }),
		scopes: [USER_SCOPE],
		annotations: { readOnly: true, destructive: false, idempotent: true },
		toolset: "traffic",
		mcp: true,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "read", input.projectId);
			const line = await requireLogLine(project._id, input.logId);
			if (line.source === "callback") {
				// The request went out of the mock to the callback's target, with
				// the hop marker: as a mock request it would mean nothing.
				throw new OperationError(
					409,
					"DRAFT_NOT_SUPPORTED",
					"Callback lines cannot be opened in the API client",
				);
			}
			return { draft: draftOfLogLine(line, deps.mockOrigin(project.secret)) };
		},
	});

	return [
		...createTrafficSettingsOperations(deps.guard),
		...requestLogOperations,
		replayRequestLog,
		getRequestLogDraft,
	];
}

/** The traffic operations of the registry (runtime guard, public mock URLs). */
export const trafficOperations: AnyOperation[] = createTrafficOperations(
	defaultReplayDeps(),
);
