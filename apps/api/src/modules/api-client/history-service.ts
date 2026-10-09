import {
	type ApiRequestDraft,
	HISTORY_MAX_ENTRIES,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import { draftBytes, draftTooLarge } from "./draft-size.js";
import {
	HistoryModel,
	type HistoryRoute,
	type StoredHistoryEntry,
} from "./history-model.js";

/**
 * Largest history entry, as JSON. Smaller than a saved tab: history keeps
 * up to `HISTORY_MAX_ENTRIES` entries per user. A larger request is kept
 * without its raw body (`bodyOmitted`) rather than not at all.
 */
export const HISTORY_ENTRY_MAX_BYTES = 256 * 1024;

/** What the browser (or the proxy) measured of the response. */
export interface HistoryResponseInput {
	readonly status: number;
	readonly ms: number;
	readonly size: number;
	readonly route: HistoryRoute;
	readonly finalUrl?: string;
}

export interface HistorySummary {
	id: string;
	name: string;
	method: ApiRequestDraft["method"];
	url: string;
	response: {
		status: number;
		ms: number;
		size: number;
		route: HistoryRoute;
		finalUrl: string | null;
	};
	bodyOmitted: boolean;
	createdAt: string;
}

export interface HistoryDetail extends HistorySummary {
	draft: ApiRequestDraft;
}

export interface HistoryPage {
	items: HistorySummary[];
	nextCursor: string | null;
}

export function toHistorySummary(doc: StoredHistoryEntry): HistorySummary {
	return {
		id: doc._id.toHexString(),
		name: doc.draft.name,
		method: doc.draft.method,
		url: doc.draft.url,
		response: { ...doc.response, finalUrl: doc.response.finalUrl ?? null },
		bodyOmitted: doc.bodyOmitted,
		createdAt: doc.createdAt.toISOString(),
	};
}

export function toHistoryDetail(doc: StoredHistoryEntry): HistoryDetail {
	return { ...toHistorySummary(doc), draft: doc.draft };
}

/**
 * Origin and path of the last hop. That URL was sent with the variables
 * filled in, so its query, fragment and credentials (where API keys
 * usually travel) are dropped. `undefined` when it is not http(s).
 */
export function historyFinalUrl(url: string | undefined): string | undefined {
	if (!url || !URL.canParse(url)) return undefined;
	const parsed = new URL(url);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		return undefined;
	}
	return `${parsed.origin}${parsed.pathname}`;
}

/** The draft within `HISTORY_ENTRY_MAX_BYTES`, its raw body dropped if needed. */
function fitHistoryDraft(draft: ApiRequestDraft): {
	draft: ApiRequestDraft;
	bodyOmitted: boolean;
} {
	if (draftBytes(draft) <= HISTORY_ENTRY_MAX_BYTES) {
		return { draft, bodyOmitted: false };
	}
	const trimmed = { ...draft, body: { ...draft.body, raw: "" } };
	const bytes = draftBytes(trimmed);
	if (bytes > HISTORY_ENTRY_MAX_BYTES) {
		throw draftTooLarge(bytes, HISTORY_ENTRY_MAX_BYTES);
	}
	return { draft: trimmed, bodyOmitted: true };
}

/** Drops the user's entries older than the newest `HISTORY_MAX_ENTRIES`. */
async function trimHistory(userSub: string): Promise<void> {
	const oldestKept = await HistoryModel.findOne({ userSub })
		.sort({ _id: -1 })
		.skip(HISTORY_MAX_ENTRIES - 1)
		.select("_id")
		.lean<{ _id: Types.ObjectId }>();
	if (!oldestKept) return;
	await HistoryModel.deleteMany({ userSub, _id: { $lt: oldestKept._id } });
}

/**
 * Records one sent request. `draft` must still hold its `{{var}}`
 * placeholders (the browser records the tab, not the prepared request).
 * Also used by the proxy's MCP tool for the requests an agent sends.
 */
export async function recordHistoryEntry(
	userSub: string,
	draft: ApiRequestDraft,
	response: HistoryResponseInput,
): Promise<HistorySummary> {
	const fitted = fitHistoryDraft(draft);
	const created = await HistoryModel.create({
		userSub,
		draft: fitted.draft,
		bodyOmitted: fitted.bodyOmitted,
		response: {
			status: response.status,
			ms: response.ms,
			size: response.size,
			route: response.route,
			finalUrl: historyFinalUrl(response.finalUrl),
		},
	});
	await trimHistory(userSub);
	return toHistorySummary(created.toObject<StoredHistoryEntry>());
}

function objectIdOrNull(value: string): Types.ObjectId | null {
	return /^[a-f0-9]{24}$/.test(value) ? new Types.ObjectId(value) : null;
}

/** Newest first; `cursor` is the id of the last item of the previous page. */
export async function listHistoryEntries(
	userSub: string,
	page: { readonly cursor?: string; readonly limit: number },
): Promise<HistoryPage> {
	const before = page.cursor ? objectIdOrNull(page.cursor) : null;
	const docs = await HistoryModel.find({
		userSub,
		...(before ? { _id: { $lt: before } } : {}),
	})
		.sort({ _id: -1 })
		.limit(page.limit + 1)
		.lean<StoredHistoryEntry[]>();
	const items = docs.slice(0, page.limit).map(toHistorySummary);
	return {
		items,
		nextCursor: docs.length > page.limit ? (items.at(-1)?.id ?? null) : null,
	};
}

/** One of the user's entries; `null` when missing or someone else's. */
export async function findHistoryEntry(
	userSub: string,
	entryId: string,
): Promise<StoredHistoryEntry | null> {
	const _id = objectIdOrNull(entryId);
	if (!_id) return null;
	return HistoryModel.findOne({ _id, userSub }).lean<StoredHistoryEntry>();
}

export async function deleteHistoryEntry(
	userSub: string,
	entryId: Types.ObjectId,
): Promise<void> {
	await HistoryModel.deleteOne({ _id: entryId, userSub });
}

/** Counts (dry run) or deletes every entry of the user. */
export async function clearHistory(
	userSub: string,
	dryRun: boolean,
): Promise<number> {
	if (dryRun) return HistoryModel.countDocuments({ userSub });
	const result = await HistoryModel.deleteMany({ userSub });
	return result.deletedCount;
}
