/**
 * Unsaved requests of the open tabs (`/api/v1/client/drafts`), so the tab
 * set survives a reload and follows the account to another browser.
 */
import {
	type ApiRequestDraft,
	apiRequestDraftSchema,
} from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { ApiError, apiRequest } from "../../../lib/api-client";
import { apiUrl } from "../../../lib/api-url";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
} from "../../../lib/json-guards";

export interface SavedDraft {
	tabId: string;
	order: number;
	draft: ApiRequestDraft;
}

const draftPath = (tabId: string) =>
	`/api/v1/client/drafts/${encodeURIComponent(tabId)}`;

/**
 * A draft the client cannot read (written by a newer version) is skipped
 * rather than failing the whole list.
 */
function parseItem(value: unknown): SavedDraft | null {
	const item = expectRecord(value, "draft");
	const parsed = apiRequestDraftSchema.safeParse(item.draft);
	if (!parsed.success) return null;
	return {
		tabId: expectString(item, "tabId"),
		order: expectNumber(item, "order"),
		draft: parsed.data,
	};
}

/** Own drafts in tab order. */
export async function listDrafts(): Promise<SavedDraft[]> {
	const data = expectRecord(
		await apiRequest("/api/v1/client/drafts"),
		"draft list",
	);
	return expectArray(data, "items")
		.map(parseItem)
		.filter((item): item is SavedDraft => item !== null)
		.sort((a, b) => a.order - b.order);
}

export async function saveDraft(
	tabId: string,
	draft: ApiRequestDraft,
	order: number,
): Promise<void> {
	await apiRequest(draftPath(tabId), {
		method: "PUT",
		body: { draft, order },
	});
}

/**
 * Browsers cap the bodies of `keepalive` requests in flight at 64 KiB
 * together; a bigger one is refused outright.
 */
export const KEEPALIVE_MAX_BYTES = 64 * 1024;

/** JSON body of a draft save and its size in bytes. */
export function draftSaveBody(
	draft: ApiRequestDraft,
	order: number,
): { json: string; bytes: number } {
	const json = JSON.stringify({ draft, order });
	return { json, bytes: new TextEncoder().encode(json).byteLength };
}

/**
 * The same save as `saveDraft`, sent with `keepalive` so it survives the
 * page unloading (`pagehide`). `json` comes from `draftSaveBody` and must
 * fit `KEEPALIVE_MAX_BYTES`.
 */
export async function saveDraftOnLeave(
	tabId: string,
	json: string,
): Promise<void> {
	const response = await fetch(apiUrl(draftPath(tabId)), {
		method: "PUT",
		headers: { Accept: "application/json", "Content-Type": "application/json" },
		body: json,
		credentials: "same-origin",
		keepalive: true,
	});
	if (response.ok) return;
	const message = activeTranslator().t("common.errors.server");
	throw new ApiError(response.status, `HTTP_${response.status}`, message);
}

export async function deleteDraft(tabId: string): Promise<void> {
	await apiRequest(draftPath(tabId), { method: "DELETE" });
}
