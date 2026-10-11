import { OperationError } from "@localman/operations";
import {
	COLLECTION_NAME_MAX,
	type CollectionDetail,
	type CollectionNode,
	type CollectionTree,
	collectionTreeToNodes,
	type collectionUpdateSchema,
} from "@localman/shared/api-client";
import type { z } from "zod";
import { elementNotFound } from "../access/access-policy.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { requireCollection } from "./collection-access.js";
import { chargeRoot, rootBytes } from "./collection-bytes.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "./collection-model.js";
import {
	type NewCollection,
	assertDraftSize,
	insertCollection,
	loadCollectionDetail,
	newNodeId,
} from "./collection-store.js";
import {
	type CollectionTemplate,
	restCrudTemplate,
} from "./rest-crud-template.js";

/** What a new collection starts from: exactly one of them. */
export interface CollectionSource {
	readonly name?: string;
	readonly tree?: CollectionTree;
	readonly template?: CollectionTemplate;
}

function emptyTree(name: string): CollectionTree {
	return {
		name,
		description: "",
		auth: { type: "none" },
		variables: [],
		scripts: { pre: "", post: "" },
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

async function insertAndLoad(input: NewCollection): Promise<CollectionDetail> {
	const id = await inWorkspaceTransaction(input.workspaceId, (session) =>
		insertCollection(input, session),
	);
	// Its creator adds elements to the workspace: an Admin or Editor there.
	return loadCollectionDetail(id, "editor");
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
	const { root, nodes } = collectionTreeToNodes(treeOf(source), newNodeId);
	for (const node of nodes) {
		if (node.kind === "request") assertDraftSize(node.draft);
	}
	return insertAndLoad({ workspaceId: workspace._id, root, nodes, sub });
}

export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;

/**
 * Edits the root (name, description, auth, scripts, variables) under the
 * workspace lock, within the collection's byte budget.
 */
export async function updateCollection(
	sub: string,
	id: string,
	update: CollectionUpdate,
): Promise<CollectionDetail> {
	const { element, collectionId, role } = await requireCollection(
		sub,
		id,
		"edit",
	);
	const set: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(update)) {
		if (value !== undefined) set[key] = value;
	}
	await inWorkspaceTransaction(element.workspaceId, async (session) => {
		const root = await CollectionModel.findOne({
			_id: collectionId,
			...LIVE_COLLECTION,
		})
			.session(session)
			.lean<StoredCollection>();
		if (!root) throw elementNotFound();
		const { name, description, auth, scripts, variables } = root;
		const before = { name, description, auth, scripts, variables };
		const bytes = rootBytes({ ...before, ...update }) - rootBytes(before);
		await chargeRoot(collectionId, sub, session, { bytes, set });
	});
	return loadCollectionDetail(collectionId, role);
}

const COPY_SUFFIX = " Copy";

/** "<name> Copy", cut so it stays within the name limit. */
export function copyName(name: string): string {
	return `${name.slice(0, COLLECTION_NAME_MAX - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
}

/**
 * Copies a collection the caller can view into a workspace where they add
 * elements (its own by default), with new node ids.
 */
export async function duplicateCollection(
	sub: string,
	id: string,
	targetWorkspaceId: string | undefined,
): Promise<CollectionDetail> {
	const { element, collectionId, role } = await requireCollection(
		sub,
		id,
		"view",
	);
	const { workspace } = await requireWorkspace(
		sub,
		"addElements",
		targetWorkspaceId ?? element.workspaceId.toHexString(),
	);
	const source = await loadCollectionDetail(collectionId, role);
	const ids = new Map(source.nodes.map((node) => [node.id, newNodeId()]));
	const nodes = source.nodes.map((node): CollectionNode => {
		const parentId = node.parentId === null ? null : ids.get(node.parentId);
		return {
			...node,
			id: ids.get(node.id) ?? newNodeId(),
			parentId: parentId ?? null,
		};
	});
	const { name, description, auth, scripts, variables } = source;
	return insertAndLoad({
		workspaceId: workspace._id,
		root: { name: copyName(name), description, auth, scripts, variables },
		nodes,
		sub,
	});
}

/** The collection as served by `GET /collections/:id` (any role). */
export async function getCollection(
	sub: string,
	id: string,
): Promise<CollectionDetail> {
	const { collectionId, role } = await requireCollection(sub, id, "view");
	return loadCollectionDetail(collectionId, role);
}
