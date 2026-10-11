/**
 * Trees sent to create a collection (pure): one built from a mock
 * project's requests, and an imported one made to fit what the API
 * accepts (names of 1–200 characters, descriptions within the cap).
 */
import {
	COLLECTION_DESCRIPTION_MAX,
	COLLECTION_NAME_MAX,
	type CollectionTree,
	type ImportedFolder,
	type ImportedItem,
} from "@localman/shared/api-client";
import type {
	MockRequest,
	MockResourceUrls,
} from "../api-client/open-in/mock-requests";

/** Names the API would refuse when blank, in the language on screen. */
export interface FallbackNames {
	collection: string;
	folder: string;
	request: string;
}

function fitName(name: string, fallback: string): string {
	const trimmed = name.trim() || fallback;
	return trimmed.slice(0, COLLECTION_NAME_MAX);
}

const fitDescription = (text: string): string =>
	text.slice(0, COLLECTION_DESCRIPTION_MAX);

function fitItems(
	items: readonly ImportedItem[],
	names: FallbackNames,
): ImportedItem[] {
	return items.map((item): ImportedItem => {
		const description = fitDescription(item.description);
		if (item.kind === "request") {
			const fallback = item.draft.url.trim() || names.request;
			return { ...item, name: fitName(item.name, fallback), description };
		}
		return {
			...item,
			name: fitName(item.name, names.folder),
			description,
			items: fitItems(item.items, names),
		};
	});
}

/** `tree` with every name and description the API would refuse fixed. */
export function fitTree(
	tree: CollectionTree,
	names: FallbackNames,
): CollectionTree {
	return {
		name: fitName(tree.name, names.collection),
		description: fitDescription(tree.description),
		auth: tree.auth,
		scripts: tree.scripts,
		variables: tree.variables.filter((v) => v.key.trim() !== ""),
		items: fitItems(tree.items, names),
	};
}

/**
 * A collection named after the project: one folder per resource holding
 * its requests, nested resources inside their parent's folder.
 */
export function mockProjectTree(
	projectName: string,
	resources: readonly MockResourceUrls[],
	requests: readonly MockRequest[],
): CollectionTree {
	const folders = new Map<string, ImportedFolder>();
	const top: ImportedItem[] = [];
	// Resources come parent first, so a parent's folder exists before its child's.
	for (const resource of resources) {
		const folder: ImportedFolder = {
			kind: "folder",
			id: `resource:${resource.id}`,
			name: resource.name,
			description: "",
			auth: { type: "inherit" },
			scripts: { pre: "", post: "" },
			items: requests
				.filter((request) => request.resourceId === resource.id)
				.map((request) => ({
					kind: "request",
					id: request.id,
					name: request.draft.name,
					description: "",
					draft: request.draft,
				})),
		};
		folders.set(resource.id, folder);
		const parent =
			resource.parentId === null ? undefined : folders.get(resource.parentId);
		if (parent) parent.items.push(folder);
		else top.push(folder);
	}
	return {
		name: projectName,
		description: "",
		auth: { type: "none" },
		variables: [],
		scripts: { pre: "", post: "" },
		items: top,
	};
}
