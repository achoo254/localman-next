/**
 * What the import dialog hands to the workbench. Phase 10 has no
 * collections yet, so imported requests open as standalone tabs: the
 * collection's variables are written into them and `inherit` auth takes
 * the folder's or collection's auth, so each tab sends as it would have
 * inside the collection.
 */
import {
	type ApiRequestDraft,
	type FlatImportedRequest,
	type ImportedCollection,
	type ImportedData,
	type ImportedEnvironment,
	applyCollectionVariables,
} from "@localman/shared/api-client";

export interface ImportedRequestsSelection {
	kind: "requests";
	/** The whole import (name, variables, warnings), for context. */
	collection: ImportedCollection;
	/** The picked requests in display order, drafts ready for a tab. */
	requests: FlatImportedRequest[];
}

export interface ImportedEnvironmentSelection {
	kind: "environment";
	environment: ImportedEnvironment;
	/** The file's JSON as written, which the server's import checks itself. */
	file: unknown;
}

export type ImportSelection =
	| ImportedRequestsSelection
	| ImportedEnvironmentSelection;

/** The draft of `request` as a tab opens it, outside its collection. */
export function standaloneDraft(
	request: FlatImportedRequest,
	collection: Pick<ImportedCollection, "variables">,
): ApiRequestDraft {
	const draft: ApiRequestDraft =
		request.draft.auth.type === "inherit"
			? { ...request.draft, auth: request.inheritedAuth }
			: request.draft;
	return applyCollectionVariables(draft, collection.variables);
}

export function toRequestsSelection(
	collection: ImportedCollection,
	picked: readonly FlatImportedRequest[],
): ImportedRequestsSelection {
	return {
		kind: "requests",
		collection,
		requests: picked.map((request) => ({
			...request,
			draft: standaloneDraft(request, collection),
		})),
	};
}

/** The JSON of the text or file the parser recognised as an environment. */
function environmentJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * What "Import" hands over: an environment file with its JSON (`text` is
 * what was pasted or read), or the picked requests of a collection.
 */
export function toSelection(
	data: ImportedData,
	picked: readonly FlatImportedRequest[],
	text: string,
): ImportSelection {
	if (data.format === "environment-v21") {
		return {
			kind: "environment",
			environment: data,
			file: environmentJson(text),
		};
	}
	return toRequestsSelection(data, picked);
}
