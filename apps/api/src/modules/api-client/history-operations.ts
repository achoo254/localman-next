import { OperationError, defineOperation } from "@localman/operations";
import {
	HISTORY_MAX_ENTRIES,
	HISTORY_TTL_DAYS,
	HTTP_METHODS,
	MAX_URL_LENGTH,
	apiRequestDraftSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { DRAFT_BODY_LIMIT } from "./draft-size.js";
import { HISTORY_ROUTES } from "./history-model.js";
import {
	HISTORY_ENTRY_MAX_BYTES,
	clearHistory as clearAllHistory,
	deleteHistoryEntry as deleteEntry,
	findHistoryEntry,
	listHistoryEntries,
	recordHistoryEntry,
	toHistoryDetail,
} from "./history-service.js";

const MAX_PAGE_SIZE = 100;
const MAX_RESPONSE_MS = 60 * 60 * 1000;
const BROWSER_SEND =
	"the browser records each request it sent, directly or through the proxy; the send_request tool records its own requests";

const entryId = z
	.string()
	.regex(/^[a-f0-9]{24}$/, "must be a history entry id");

const historySummary = z.object({
	id: z.string(),
	name: z.string(),
	method: z.enum(HTTP_METHODS),
	/** As typed, `{{var}}` placeholders kept. */
	url: z.string(),
	response: z.object({
		status: z.number().int(),
		ms: z.number(),
		size: z.number().int(),
		route: z.enum(HISTORY_ROUTES),
		finalUrl: z.string().nullable(),
	}),
	bodyOmitted: z.boolean(),
	createdAt: z.string(),
});

const historyDetail = historySummary.extend({ draft: apiRequestDraftSchema });

const ABOUT = `History of the API client, newest first, own entries only. Requests are stored as written, {{var}} placeholders unfilled; of the response only status, time, size, route and the final URL's origin and path are kept. Entries expire after ${HISTORY_TTL_DAYS} days; at most ${HISTORY_MAX_ENTRIES} are kept per user.`;

async function requireEntry(userSub: string, id: string) {
	const entry = await findHistoryEntry(userSub, id);
	if (!entry) {
		throw new OperationError(404, "NOT_FOUND", "History entry not found");
	}
	return entry;
}

export const listHistory = defineOperation({
	id: "client.listHistory",
	method: "GET",
	path: "/client/history",
	summary: "List the API client's request history",
	description: `${ABOUT} Paginated with \`cursor\` (the \`nextCursor\` of the previous page); get one entry for the full request.`,
	input: z.object({
		cursor: entryId.optional(),
		limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
	}),
	output: z.object({
		items: z.array(historySummary),
		nextCursor: z.string().nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => listHistoryEntries(requireSubject(ctx), input),
});

export const getHistoryEntry = defineOperation({
	id: "client.getHistoryEntry",
	method: "GET",
	path: "/client/history/:entryId",
	summary: "Get one request from the API client's history",
	description: ABOUT,
	input: z.object({ entryId }),
	output: historyDetail,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		toHistoryDetail(await requireEntry(requireSubject(ctx), input.entryId)),
});

export const recordHistory = defineOperation({
	id: "client.recordHistory",
	method: "POST",
	path: "/client/history",
	summary: "Record a sent request in the API client's history",
	description: `${ABOUT} \`draft\` is the tab as written (never the request with variables filled in). Above ${HISTORY_ENTRY_MAX_BYTES} bytes the raw body is dropped (\`bodyOmitted\`); if still too large, 413 DRAFT_TOO_LARGE.`,
	input: z.object({
		draft: apiRequestDraftSchema,
		response: z.object({
			status: z.number().int().min(100).max(599),
			// Total time; a bound, not a timeout (the send itself caps at 120 s).
			ms: z.number().min(0).max(MAX_RESPONSE_MS),
			size: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
			route: z.enum(HISTORY_ROUTES),
			finalUrl: z.string().max(MAX_URL_LENGTH).optional(),
		}),
	}),
	output: historySummary,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: { exempt: BROWSER_SEND },
	bodyLimit: DRAFT_BODY_LIMIT,
	successStatus: 201,
	handler: async (ctx, input) =>
		recordHistoryEntry(requireSubject(ctx), input.draft, input.response),
});

export const deleteHistoryEntry = defineOperation({
	id: "client.deleteHistoryEntry",
	method: "DELETE",
	path: "/client/history/:entryId",
	summary: "Delete one request from the API client's history",
	description: "Own entries only. Call with dryRun to see the entry first.",
	input: z.object({ entryId }),
	output: z.object({
		id: z.string(),
		deleted: z.boolean(),
		dryRun: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const userSub = requireSubject(ctx);
		const entry = await requireEntry(userSub, input.entryId);
		if (!ctx.dryRun) await deleteEntry(userSub, entry._id);
		return {
			id: entry._id.toHexString(),
			deleted: !ctx.dryRun,
			dryRun: ctx.dryRun,
		};
	},
});

export const clearHistory = defineOperation({
	id: "client.clearHistory",
	method: "DELETE",
	path: "/client/history",
	summary: "Delete the whole API client history of the signed-in user",
	description:
		"Removes every history entry of the caller (saved tabs are kept). Call with dryRun first to see how many entries would go.",
	input: z.object({}),
	output: z.object({
		entryCount: z.number().int(),
		deleted: z.boolean(),
		dryRun: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: async (ctx) => ({
		entryCount: await clearAllHistory(requireSubject(ctx), ctx.dryRun),
		deleted: !ctx.dryRun,
		dryRun: ctx.dryRun,
	}),
});

export const historyOperations = [
	listHistory,
	getHistoryEntry,
	recordHistory,
	deleteHistoryEntry,
	clearHistory,
] as const;
