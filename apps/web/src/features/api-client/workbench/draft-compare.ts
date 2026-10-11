import {
	type ApiRequestDraft,
	createRequestDraft,
} from "@localman/shared/api-client";

/** JSON with sorted keys, so two drafts compare by content only. */
export function stableJson(value: unknown): string {
	return JSON.stringify(value, (_key, inner: unknown) => {
		if (inner === null || typeof inner !== "object" || Array.isArray(inner)) {
			return inner;
		}
		const entries = Object.entries(inner);
		entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return Object.fromEntries(entries);
	});
}

const BLANK = stableJson(createRequestDraft());

/** A new, untouched request (settings and route included). */
export function isBlankDraft(draft: ApiRequestDraft): boolean {
	return stableJson(draft) === BLANK;
}

/**
 * JSON of each draft object, computed once: a bound tab compares every
 * keystroke's draft with the same saved one, which is serialized only once.
 */
const serialized = new WeakMap<ApiRequestDraft, string>();

function jsonOf(draft: ApiRequestDraft): string {
	let json = serialized.get(draft);
	if (json === undefined) {
		json = stableJson(draft);
		serialized.set(draft, json);
	}
	return json;
}

/** Same request content (key order and object identity aside). */
export function sameDraft(a: ApiRequestDraft, b: ApiRequestDraft): boolean {
	return a === b || jsonOf(a) === jsonOf(b);
}

/** Unsaved changes: anything for a loose tab, a difference for a bound one. */
export function isDirty(
	draft: ApiRequestDraft,
	saved: ApiRequestDraft | null,
): boolean {
	return saved === null || !sameDraft(draft, saved);
}
