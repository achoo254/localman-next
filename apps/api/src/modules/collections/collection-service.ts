import { OperationError } from "@localman/operations";
import {
	type CollectionDetail,
	type CollectionTree,
	collectionTreeToNodes,
} from "@localman/shared/api-client";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { type NewCollection, insertCollection } from "./collection-insert.js";
import { requireReadableProject } from "./collection-links.js";
import { loadCollectionDetail, newNodeId } from "./collection-store.js";
import {
	type CollectionTemplate,
	restCrudTemplate,
} from "./rest-crud-template.js";

/** What a new collection starts from: exactly one of them. */
export interface CollectionSource {
	readonly name?: string;
	readonly tree?: CollectionTree;
	readonly template?: CollectionTemplate;
	/** The mock project it is made from (a link only). */
	readonly mockProjectId?: string;
}

function emptyTree(name: string): CollectionTree {
	return {
		name,
		description: "",
		auth: { type: "none" },
		variables: [],
		scripts: { pre: "", post: "" },
		tags: [],
		status: null,
		items: [],
	};
}

function treeOf(source: CollectionSource): CollectionTree {
	if (source.tree && source.template) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			"Send either a tree or a template, not both",
		);
	}
	if (source.tree) {
		return source.name ? { ...source.tree, name: source.name } : source.tree;
	}
	if (source.template === "rest-crud") return restCrudTemplate(source.name);
	if (source.name) return emptyTree(source.name);
	throw new OperationError(
		400,
		"VALIDATION_ERROR",
		"Send a name, a tree or a template",
	);
}

export async function insertAndLoad(
	input: NewCollection,
): Promise<CollectionDetail> {
	const id = await inWorkspaceTransaction(input.workspaceId, (session) =>
		insertCollection(input, session),
	);
	// Its creator adds elements to the workspace: an Admin or Editor there.
	return loadCollectionDetail(id, "editor", input.sub);
}

/**
 * Creates a collection in the workspace (Admin or Editor there): empty,
 * from a template or from an imported tree.
 */
export async function createCollection(
	sub: string,
	workspaceId: string,
	source: CollectionSource,
): Promise<CollectionDetail> {
	const { workspace } = await requireWorkspace(sub, "addElements", workspaceId);
	const mockProjectId =
		source.mockProjectId === undefined
			? undefined
			: await requireReadableProject(sub, source.mockProjectId);
	const { root, nodes } = collectionTreeToNodes(treeOf(source), newNodeId);
	return insertAndLoad({
		workspaceId: workspace._id,
		root,
		nodes,
		sub,
		...(mockProjectId ? { mockProjectId } : {}),
	});
}

/** The collection as served by `GET /collections/:id` (any role). */
export async function getCollection(
	sub: string,
	id: string,
): Promise<CollectionDetail> {
	const { collectionId, role } = await requireCollection(sub, id, "view");
	return loadCollectionDetail(collectionId, role, sub);
}
