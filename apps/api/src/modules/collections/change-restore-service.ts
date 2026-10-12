import { OperationError } from "@localman/operations";
import {
	COLLECTION_NODES_MAX,
	type CollectionDetail,
} from "@localman/shared/api-client";
import { type ClientSession, Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { revisionNotFound } from "./changelog-service.js";
import { requireCollection } from "./collection-access.js";
import {
	COLLECTION_BYTES_MAX,
	collectionTooLarge,
	nodeBytes,
	rootBytes,
} from "./collection-bytes.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import {
	CollectionRevisionModel,
	type StoredRevision,
} from "./collection-revision-model.js";
import {
	loadCollectionDetail,
	nodesLimitReached,
	storedNodeOf,
} from "./collection-store.js";
import {
	type CollectionState,
	applyInPlace,
	buildRevision,
} from "./revision-patch.js";
import { loadState } from "./revision-state.js";
import { chargeRoot } from "./root-change.js";
import { foldSearchText } from "./search-text.js";

function unavailable(): OperationError {
	return new OperationError(
		409,
		"REVISION_UNAVAILABLE",
		"The collection can no longer be restored to this change",
	);
}

/**
 * The revision, or why it cannot be restored: 409 for a trimmed one (its
 * stub is kept), 404 for an id this collection never issued.
 */
async function revisionToRestore(
	collectionId: Types.ObjectId,
	revisionId: string,
	session: ClientSession,
): Promise<StoredRevision> {
	const _id = toObjectId(revisionId);
	const rev = _id
		? await CollectionRevisionModel.findOne({ _id, collectionId })
				.session(session)
				.lean<StoredRevision>()
		: null;
	if (!rev) throw revisionNotFound();
	if (rev.trimmed) throw unavailable();
	return rev;
}

/** The state right after `rev`: the current one with later changes undone. */
async function stateAfter(
	collectionId: Types.ObjectId,
	rev: StoredRevision,
	session: ClientSession,
): Promise<{ current: CollectionState; target: CollectionState }> {
	const later = await CollectionRevisionModel.find(
		{ collectionId, seq: { $gt: rev.seq } },
		{ inverse: 1, partial: 1 },
	)
		.session(session)
		.sort({ seq: -1 })
		.lean<Pick<StoredRevision, "inverse" | "partial">[]>();
	if (later.some((row) => row.partial)) throw unavailable();
	const current = await loadState(collectionId, session);
	try {
		const target = structuredClone(current);
		for (const row of later) applyInPlace(target, row.inverse);
		return { current, target };
	} catch {
		throw unavailable();
	}
}

export interface ChangeRestore {
	readonly dryRun: boolean;
	readonly restored: boolean;
	/** Recorded without patches: it cannot be undone and blocks older restores. */
	readonly irreversible: boolean;
	/** The collection after the restore; `null` for a dry run. */
	readonly collection: CollectionDetail | null;
}

const stateBytes = (state: CollectionState): number =>
	Object.values(state.nodes).reduce(
		(sum, node) => sum + nodeBytes(node),
		rootBytes(state.root),
	);
const stateRequests = (state: CollectionState): number =>
	Object.values(state.nodes).filter((node) => node.kind === "request").length;

/**
 * Writes `target` over `current` (changed and gone nodes, new nodes, root)
 * with one `restore` revision; a dry run only checks the limits. Returns
 * whether the revision would be kept without patches.
 */
async function writeState(
	collectionId: Types.ObjectId,
	sub: string,
	session: ClientSession,
	states: { current: CollectionState; target: CollectionState },
	dryRun: boolean,
): Promise<boolean> {
	const { current, target } = states;
	const nodes = Object.values(target.nodes);
	if (nodes.length > COLLECTION_NODES_MAX)
		throw nodesLimitReached(nodes.length);
	const bytes = stateBytes(target) - stateBytes(current);
	if (bytes > 0 && stateBytes(target) > COLLECTION_BYTES_MAX) {
		throw collectionTooLarge(stateBytes(target));
	}
	const revision = buildRevision({
		entity: "collection",
		entityId: collectionId.toHexString(),
		entityKind: "collection",
		entityName: target.root.name,
		action: "restore",
		before: current,
		after: target,
	});
	if (dryRun) return revision.partial;
	await chargeRoot(collectionId, sub, session, {
		bytes,
		requests: stateRequests(target) - stateRequests(current),
		set: { ...target.root, searchName: foldSearchText(target.root.name) },
		revisions: [revision],
	});
	const same = (id: string) =>
		JSON.stringify(current.nodes[id]) === JSON.stringify(target.nodes[id]);
	const staleIds = Object.keys(current.nodes)
		.filter((id) => !same(id))
		.map((id) => new Types.ObjectId(id));
	await CollectionNodeModel.deleteMany(
		{ collectionId, _id: { $in: staleIds } },
		{ session },
	);
	const fresh = nodes.filter((node) => !same(node.id));
	if (fresh.length > 0) {
		const docs = fresh.map((node) => storedNodeOf(node, collectionId, sub));
		await CollectionNodeModel.insertMany(docs, { session });
	}
	return revision.partial;
}

/**
 * "Restore to this change" (Editor): brings the collection back to its
 * state right after the revision by undoing every later change, newest
 * first, and writes the result as one new revision (history is kept).
 * Under the workspace lock, within the node limit and byte budget. 409
 * `REVISION_UNAVAILABLE` when a change on the way kept no patches or the
 * revision was trimmed away. A dry run reports `irreversible` only.
 */
export async function restoreToChange(
	sub: string,
	id: string,
	revisionId: string,
	dryRun: boolean,
): Promise<ChangeRestore> {
	const { element, collectionId, role } = await requireCollection(
		sub,
		id,
		"edit",
	);
	const irreversible = await inWorkspaceTransaction(
		element.workspaceId,
		async (session) => {
			const rev = await revisionToRestore(collectionId, revisionId, session);
			const states = await stateAfter(collectionId, rev, session);
			return writeState(collectionId, sub, session, states, dryRun);
		},
	);
	const collection = dryRun
		? null
		: await loadCollectionDetail(collectionId, role, sub);
	return { dryRun, restored: !dryRun, irreversible, collection };
}
