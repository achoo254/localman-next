/**
 * Collection, folder and example tabs kept in this browser per account
 * (`localman-pages:<sub>`): the drafts API keeps request tabs only. Read
 * and written in a try/catch (storage may be unavailable).
 */
import type { PageTab } from "../api-client/workbench/workbench-tab-types";

const PREFIX = "localman-pages:";

export const pagesStorageKey = (sub: string) => `${PREFIX}${sub}`;

const KINDS: readonly PageTab["kind"][] = ["collection", "folder", "example"];

function isPage(value: unknown): value is PageTab {
	if (typeof value !== "object" || value === null) return false;
	const id = Reflect.get(value, "id");
	const kind = Reflect.get(value, "kind");
	const collectionId = Reflect.get(value, "collectionId");
	const nodeId = Reflect.get(value, "nodeId");
	const name = Reflect.get(value, "name");
	return (
		typeof id === "string" &&
		KINDS.some((item) => item === kind) &&
		typeof collectionId === "string" &&
		(nodeId === null || typeof nodeId === "string") &&
		typeof name === "string"
	);
}

/** Saved pages of an account; anything unreadable is dropped. */
export function readPages(sub: string): PageTab[] {
	try {
		const raw = window.localStorage.getItem(pagesStorageKey(sub));
		const parsed: unknown = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed.filter(isPage).slice(0, 50) : [];
	} catch {
		return [];
	}
}

/**
 * Signing out forgets the saved pages of every account in this browser,
 * so the next person on a shared device does not see their tab names.
 */
export function forgetSavedPages(): void {
	try {
		const keys = Array.from({ length: window.localStorage.length }, (_, i) =>
			window.localStorage.key(i),
		);
		for (const key of keys) {
			if (key?.startsWith(PREFIX)) window.localStorage.removeItem(key);
		}
	} catch {
		// Storage unavailable: nothing was kept.
	}
}
