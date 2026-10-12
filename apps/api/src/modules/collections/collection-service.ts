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
import { rootBytes } from "./collection-bytes.js";
import { type NewCollection, insertCollection } from "./collection-insert.js";
import {
	requireLinkableEnvironment,
	requireReadableProject,
} from "./collection-links.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "./collection-model.js";
import { loadCollectionDetail, newNodeId } from "./collection-store.js";
import {
	type CollectionTemplate,
	restCrudTemplate,
} from "./rest-crud-template.js";
import { rootRevision, rootStateOf } from "./revision-drafts.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

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

export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;

/**
 * Edits the root (name, description, auth, scripts, variables, tags,
 * status) under the workspace lock, within the collection's byte budget,
 * with a changelog entry.
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
	const { linkedEnvironmentId, mockProjectId, ...content } = update;
	const set: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(content)) {
		if (value !== undefined) set[key] = value;
	}
	if (content.name !== undefined) {
		set.searchName = foldSearchText(content.name);
	}
	// Links stay out of the changelog; `null` records "none".
	if (linkedEnvironmentId !== undefined) {
		set.linkedEnvironmentId =
			linkedEnvironmentId === null
				? null
				: await requireLinkableEnvironment(
						sub,
						element.workspaceId,
						linkedEnvironmentId,
					);
	}
	if (mockProjectId !== undefined) {
		set.mockProjectId =
			mockProjectId === null
				? null
				: await requireReadableProject(sub, mockProjectId);
	}
	await inWorkspaceTransaction(element.workspaceId, async (session) => {
		const root = await CollectionModel.findOne({
			_id: collectionId,
			...LIVE_COLLECTION,
		})
			.session(session)
			.lean<StoredCollection>();
		if (!root) throw elementNotFound();
		const before = rootStateOf(root);
		const after = { ...before, ...definedOf(content) };
		const bytes = rootBytes(after) - rootBytes(before);
		const revision = rootRevision(
			"update",
			element.id,
			after.name,
			before,
			after,
		);
		await chargeRoot(collectionId, sub, session, {
			bytes,
			set,
			revisions: [revision],
		});
	});
	return loadCollectionDetail(collectionId, role, sub);
}

type ContentUpdate = Omit<
	CollectionUpdate,
	"linkedEnvironmentId" | "mockProjectId"
>;

/** The fields of `update` that were sent (absent ones stay). */
function definedOf(update: ContentUpdate): ContentUpdate {
	return Object.fromEntries(
		Object.entries(update).filter(([, value]) => value !== undefined),
	);
}

/** The collection as served by `GET /collections/:id` (any role). */
export async function getCollection(
	sub: string,
	id: string,
): Promise<CollectionDetail> {
	const { collectionId, role } = await requireCollection(sub, id, "view");
	return loadCollectionDetail(collectionId, role, sub);
}
