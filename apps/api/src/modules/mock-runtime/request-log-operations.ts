import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { logFilterInput, parseLogFilter } from "./request-log-filter.js";
import {
	countLogLines,
	deleteLogLines,
	listLogLines,
	requireLogLine,
} from "./request-log-store.js";
import {
	logLineView,
	logSummaryView,
	toLogLine,
	toLogSummary,
} from "./request-log-view.js";

const projectId = z.string().min(1).max(64);
const logId = z.string().min(1).max(64);
export const MAX_LOG_PAGE = 100;

const FILTERS =
	"Filters (all optional, combined with AND): method (comma list, e.g. GET,POST), status (codes or classes, e.g. 404,5xx), source (mock, rule, upstream, inbox, callback; comma list) and path (case-insensitive substring).";

export const listRequestLogs = defineOperation({
	id: "traffic.listRequestLogs",
	method: "GET",
	path: "/projects/:projectId/request-logs",
	summary: "List a mock project's request log, newest first",
	description: `Requests the mock runtime received, newest first, one row each: time, method, path (below the secret, prefix included), query, status, ms, source (mock, rule, upstream; later inbox, callback) and body sizes. ${FILTERS} Pages of \`limit\` (1-${MAX_LOG_PAGE}, default 50); pass \`nextCursor\` as \`cursor\` for the next page (null at the end). Members of the project only.`,
	input: z.object({
		projectId,
		...logFilterInput,
		cursor: z.string().max(64).optional(),
		limit: z.number().int().min(1).max(MAX_LOG_PAGE).optional(),
	}),
	output: z.object({
		items: z.array(logSummaryView),
		nextCursor: z.string().nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "traffic",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const filter = parseLogFilter(input);
		const project = await requireProject(sub, "read", input.projectId);
		const page = await listLogLines(
			project._id,
			filter,
			input.limit ?? 50,
			input.cursor,
		);
		return {
			items: page.items.map(toLogSummary),
			nextCursor: page.nextCursor,
		};
	},
});

export const getRequestLog = defineOperation({
	id: "traffic.getRequestLog",
	method: "GET",
	path: "/projects/:projectId/request-logs/:logId",
	summary: "Get one request log line with headers and bodies",
	description:
		"The row plus request and response: headers in order (authorization, cookie, set-cookie, x-api-key and the project's extra names read [redacted]) and bodies as UTF-8 text or base64 (bodyEncoding), cut at 64 KB (truncated, size is the whole body). Members of the project only.",
	input: z.object({ projectId, logId }),
	output: logLineView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "traffic",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "read", input.projectId);
		return toLogLine(await requireLogLine(project._id, input.logId));
	},
});

export const deleteRequestLogs = defineOperation({
	id: "traffic.deleteRequestLogs",
	method: "DELETE",
	path: "/projects/:projectId/request-logs",
	summary: "Clear a mock project's whole request log",
	description:
		"Owner only (collaborators get 403). Removes every logged request of the project for every member; new requests keep being logged. Call with dryRun first to see how many lines would go.",
	input: z.object({ projectId }),
	output: z.object({ dryRun: z.boolean(), deleted: z.number() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "traffic",
	mcp: true,
	dryRun: true,
	// Everyone on the project loses the rows: dry run and confirm token first.
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		if (ctx.dryRun) {
			return { dryRun: true, deleted: await countLogLines(project._id) };
		}
		return { dryRun: false, deleted: await deleteLogLines(project._id) };
	},
});

export const requestLogOperations: AnyOperation[] = [
	listRequestLogs,
	getRequestLog,
	deleteRequestLogs,
];
