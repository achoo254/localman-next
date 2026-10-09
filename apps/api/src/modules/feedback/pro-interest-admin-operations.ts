import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE } from "../../http/require-auth.js";
import { saigonDate } from "../../time/saigon-time.js";
import { ownerOnly } from "../users/owner-access.js";
import { FeedbackModel, type StoredProInterest } from "./feedback-model.js";
import {
	exportProInterestCsv,
	proInterestFilter,
	proInterestItem,
	proInterestStats,
	proInterestStatsSchema,
	toMongoFilter,
	toProInterestItem,
} from "./pro-interest-admin-service.js";

const OWNER_NOTE =
	"Localman owners only (OWNER_SUBS); others get 403 before any input check.";
const READ = { readOnly: true, destructive: false, idempotent: true } as const;
const entryId = z.string().min(1).max(64);
const OBJECT_ID = /^[a-f\d]{24}$/i;

async function requireEntry(id: string): Promise<StoredProInterest> {
	const entry = OBJECT_ID.test(id)
		? await FeedbackModel.findOne({
				_id: id,
				type: "pro_interest",
			}).lean<StoredProInterest>()
		: null;
	if (!entry) throw new OperationError(404, "NOT_FOUND", "Entry not found");
	return entry;
}

export const getProInterestStats = defineOperation({
	id: "admin.getProInterestStats",
	method: "GET",
	path: "/admin/pro-interest/stats",
	summary: "Get Pro interest statistics",
	description: `Total sign-ups of interest in Pro, new ones in the last 7 and 30 days, and counts per form source and per need. ${OWNER_NOTE}`,
	input: z.object({}),
	output: proInterestStatsSchema,
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: READ,
	toolset: "admin",
	mcp: true,
	handler: () => proInterestStats(),
});

export const listProInterests = defineOperation({
	id: "admin.listProInterests",
	method: "GET",
	path: "/admin/pro-interest",
	summary: "List people interested in Pro",
	description: `Newest first, filtered by source, need, contacted state or an email fragment, one page at a time. ${OWNER_NOTE}`,
	input: proInterestFilter.extend({
		page: z.number().int().min(1).default(1),
		pageSize: z.number().int().min(1).max(100).default(20),
	}),
	output: z.object({
		items: z.array(proInterestItem),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: READ,
	toolset: "admin",
	mcp: true,
	handler: async (_ctx, input) => {
		const query = toMongoFilter(input);
		const [docs, total] = await Promise.all([
			FeedbackModel.find(query)
				.sort({ createdAt: -1, _id: -1 })
				.skip((input.page - 1) * input.pageSize)
				.limit(input.pageSize)
				.lean<StoredProInterest[]>(),
			FeedbackModel.countDocuments(query),
		]);
		return {
			items: docs.map(toProInterestItem),
			total,
			page: input.page,
			pageSize: input.pageSize,
		};
	},
});

export const exportProInterests = defineOperation({
	id: "admin.exportProInterests",
	method: "GET",
	path: "/admin/pro-interest/export",
	summary: "Export people interested in Pro as CSV",
	description: `CSV text (UTF-8 with BOM, CRLF) of the entries matching the filters, newest first, at most 10000 rows; cells that spreadsheets would run as formulas are prefixed with '. Returned as JSON \`{ filename, csv }\`. ${OWNER_NOTE}`,
	input: proInterestFilter,
	output: z.object({ filename: z.string(), csv: z.string() }),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: READ,
	toolset: "admin",
	mcp: true,
	handler: async (_ctx, input) => ({
		filename: `pro-interest-${saigonDate(new Date())}.csv`,
		csv: await exportProInterestCsv(input),
	}),
});

export const markProInterestContacted = defineOperation({
	id: "admin.markProInterestContacted",
	method: "PUT",
	path: "/admin/pro-interest/:entryId/contacted",
	summary: "Mark a Pro interest entry as contacted or not",
	description: `Sets (contacted: true) or clears the contacted date of one entry. ${OWNER_NOTE}`,
	input: z.object({ entryId, contacted: z.boolean() }),
	output: proInterestItem,
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "admin",
	mcp: true,
	handler: async (_ctx, input) => {
		const entry = await requireEntry(input.entryId);
		// Keep the first contact date when marked again.
		const update = input.contacted
			? { $set: { contactedAt: entry.contactedAt ?? new Date() } }
			: { $unset: { contactedAt: 1 } };
		const updated = await FeedbackModel.findByIdAndUpdate(entry._id, update, {
			returnDocument: "after",
		}).lean<StoredProInterest>();
		if (!updated) throw new OperationError(404, "NOT_FOUND", "Entry not found");
		return toProInterestItem(updated);
	},
});

export const deleteProInterest = defineOperation({
	id: "admin.deleteProInterest",
	method: "DELETE",
	path: "/admin/pro-interest/:entryId",
	summary: "Delete a Pro interest entry",
	description: `Erases one entry and its email for good, e.g. when the person asks to be forgotten. Call with dryRun first. ${OWNER_NOTE}`,
	input: z.object({ entryId }),
	output: z.object({
		id: z.string(),
		deleted: z.boolean(),
		dryRun: z.boolean(),
	}),
	scopes: [USER_SCOPE],
	guard: ownerOnly,
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "admin",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const entry = await requireEntry(input.entryId);
		if (!ctx.dryRun) await FeedbackModel.deleteOne({ _id: entry._id });
		return {
			id: entry._id.toHexString(),
			deleted: !ctx.dryRun,
			dryRun: ctx.dryRun,
		};
	},
});

export const proInterestAdminOperations = [
	getProInterestStats,
	listProInterests,
	exportProInterests,
	markProInterestContacted,
	deleteProInterest,
] as const;
