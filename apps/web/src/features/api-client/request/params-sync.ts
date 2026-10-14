/**
 * Two-way link between the URL's query and the Params table. Each side
 * only rewrites the other when it is the one being edited, and a pair the
 * edit did not touch keeps its text as typed (`?flag` stays `?flag`, `~`
 * and `,` stay unescaped), so what the user sees is what goes out. The
 * query logic lives in `@localman/shared/api-client` (`query-pairs.ts`),
 * where redaction uses it too.
 */
import {
	type ApiRequestDraft,
	queryMatchesParams,
	splitUrl,
} from "@localman/shared/api-client";

/**
 * The draft to prepare for the wire. When the URL's query already holds
 * every enabled param it goes out as typed: the preparer would otherwise
 * re-encode it from the params (`?flag` → `?flag=`, `~` → `%7E`). A query
 * with `{{var}}` still goes through the params, which encode filled values.
 */
export function withVerbatimQuery(draft: ApiRequestDraft): ApiRequestDraft {
	if (draft.params.length === 0) return draft;
	if (splitUrl(draft.url).query.includes("{{")) return draft;
	if (!queryMatchesParams(draft.url, draft.params)) return draft;
	return { ...draft, params: [] };
}
