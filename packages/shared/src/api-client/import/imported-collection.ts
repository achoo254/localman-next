/**
 * What an import produces: a tree of folders and requests with the
 * collection's auth, variables and scripts. Phase 10 opens the requests as
 * tabs; phase 12 stores the same tree as a collection. Export reads the
 * same shape, so import and export round-trip.
 */
import { resolveEffectiveAuth } from "../auth-headers.js";
import type {
	CollectionStatus,
	ExampleResponse,
} from "../collections/collection-model.js";
import type {
	ApiRequestDraft,
	EffectiveAuth,
	RequestAuth,
	RequestScripts,
} from "../request-model.js";
import type { VariableEntry } from "../variable-interpolation.js";
import type { RequestImportWarning } from "./import-error.js";

/** A saved response of a request (v2.1 `response[]`). */
export interface ImportedExample {
	id: string;
	name: string;
	request: ApiRequestDraft;
	response: ExampleResponse;
}

export interface ImportedRequest {
	kind: "request";
	/** Unique within one import (the picker selects by it). */
	id: string;
	name: string;
	description: string;
	draft: ApiRequestDraft;
	/** Saved responses, in file order. */
	examples: ImportedExample[];
}

export interface ImportedFolder {
	kind: "folder";
	id: string;
	name: string;
	description: string;
	/** `inherit` unless the folder sets its own. */
	auth: RequestAuth;
	scripts: RequestScripts;
	items: ImportedItem[];
}

export type ImportedItem = ImportedRequest | ImportedFolder;

/** A collection as import produces it and export reads it. */
export interface CollectionTree {
	name: string;
	description: string;
	/** Auth the top-level items inherit; `none` when the file sets none. */
	auth: EffectiveAuth;
	/** Collection variables (`{{baseUrl}}`…), in file order. */
	variables: VariableEntry[];
	scripts: RequestScripts;
	items: ImportedItem[];
	/** Tags of the collection (Localman extension), lower-case. */
	tags: string[];
	/** Status tag (Localman extension), `null` when none. */
	status: CollectionStatus | null;
}

export const COLLECTION_IMPORT_FORMATS = [
	"curl",
	"collection-v21",
	"openapi",
] as const;
export type CollectionImportFormat = (typeof COLLECTION_IMPORT_FORMATS)[number];

export interface ImportedCollection extends CollectionTree {
	format: CollectionImportFormat;
	warnings: RequestImportWarning[];
}

/** An environment file (v2.1 format): a name and its variables. */
export interface ImportedEnvironment {
	format: "environment-v21";
	name: string;
	variables: VariableEntry[];
	warnings: RequestImportWarning[];
}

export type ImportedData = ImportedCollection | ImportedEnvironment;

/** A request of the tree with what it needs to open on its own. */
export interface FlatImportedRequest {
	id: string;
	name: string;
	description: string;
	/** Names of the folders above it, outermost first. */
	folderPath: string[];
	draft: ApiRequestDraft;
	/** Auth a draft with `inherit` takes from its folders or collection. */
	inheritedAuth: EffectiveAuth;
}

/** Every request of the tree in display order, `inherit` resolved. */
export function flattenImportedRequests(
	tree: CollectionTree,
): FlatImportedRequest[] {
	const out: FlatImportedRequest[] = [];
	const visit = (
		items: readonly ImportedItem[],
		folderPath: string[],
		inheritedAuth: EffectiveAuth,
	): void => {
		for (const item of items) {
			if (item.kind === "request") {
				const { id, name, description, draft } = item;
				out.push({ id, name, description, folderPath, draft, inheritedAuth });
			} else {
				const auth = resolveEffectiveAuth(item.auth, inheritedAuth);
				visit(item.items, [...folderPath, item.name], auth);
			}
		}
	};
	visit(tree.items, [], tree.auth);
	return out;
}

/** Number of requests in the tree. */
export function countImportedRequests(items: readonly ImportedItem[]): number {
	let count = 0;
	for (const item of items) {
		count += item.kind === "request" ? 1 : countImportedRequests(item.items);
	}
	return count;
}

/** A flat collection of drafts, for exporting the open tabs. */
export function collectionFromDrafts(
	name: string,
	drafts: readonly { id: string; draft: ApiRequestDraft }[],
): CollectionTree {
	return {
		name,
		description: "",
		auth: { type: "none" },
		variables: [],
		scripts: { pre: "", post: "" },
		tags: [],
		status: null,
		items: drafts.map(({ id, draft }) => ({
			kind: "request",
			id,
			name: draft.name,
			description: "",
			draft,
			examples: [],
		})),
	};
}
