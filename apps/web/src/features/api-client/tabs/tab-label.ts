import type { ApiRequestDraft } from "@localman/shared/api-client";

/** Name of a tab: the request name, else its URL without scheme and query. */
export function tabLabel(draft: ApiRequestDraft): string {
	const name = draft.name.trim();
	if (name) return name;
	return draft.url
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
		.split(/[?#]/, 1)[0];
}
