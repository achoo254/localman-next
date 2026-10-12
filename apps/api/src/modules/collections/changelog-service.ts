import { OperationError } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import {
	type ActivityItem,
	CHANGELOG_REVISIONS_MAX,
	type ChangelogChange,
	type ChangelogDiff,
	type ChangelogPage,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { displayNames } from "../users/display-names.js";
import { affectedNodes } from "./changelog-affected.js";
import { loadChangelogPage } from "./changelog-page.js";
import { type RevisionMeta, toChange, toSessions } from "./changelog-view.js";
import { requireCollection } from "./collection-access.js";
import { toObjectId } from "./collection-ids.js";
import {
	CollectionRevisionModel,
	type StoredRevision,
} from "./collection-revision-model.js";
import { applyInPlace, opsOf } from "./revision-patch.js";
import { entityIn, loadEntitySlice } from "./revision-state.js";

const META = { forward: 0, inverse: 0 } as const;

export function revisionNotFound(): OperationError {
	return new OperationError(404, "REVISION_NOT_FOUND", "Change not found");
}

/** Seq of the newest revision kept without patches (0 when none). */
export async function newestPartialSeq(
	collectionId: Types.ObjectId,
): Promise<number> {
	const row = await CollectionRevisionModel.findOne(
		{ collectionId, partial: true },
		{ seq: 1 },
	)
		.sort({ seq: -1 })
		.lean<{ seq: number }>();
	return row?.seq ?? 0;
}

/**
 * One page of the changelog (any role), newest first, grouped into
 * sessions that never straddle two pages. `before` is the `nextBefore` of
 * the previous page.
 */
export async function listChangelog(
	sub: string,
	id: string,
	before: string | undefined,
): Promise<ChangelogPage> {
	const { collectionId } = await requireCollection(sub, id, "view");
	const below = before === undefined ? null : Number(before);
	const { rows, nextBefore } = await loadChangelogPage(collectionId, below);
	const [partial, names] = await Promise.all([
		newestPartialSeq(collectionId),
		displayNames(rows.map((rev) => rev.authorId)),
	]);
	return { sessions: toSessions(rows, partial, names), nextBefore };
}

/** The latest changes with their authors, for the Overview (any role). */
export async function listActivity(
	sub: string,
	id: string,
	limit: number,
): Promise<ActivityItem[]> {
	const { collectionId } = await requireCollection(sub, id, "view");
	const rows = await CollectionRevisionModel.find(
		{ collectionId, trimmed: { $ne: true } },
		META,
	)
		.sort({ seq: -1 })
		.limit(limit)
		.lean<RevisionMeta[]>();
	const [partial, names] = await Promise.all([
		newestPartialSeq(collectionId),
		displayNames(rows.map((rev) => rev.authorId)),
	]);
	return rows.map((rev) => ({
		...toChange(rev, partial),
		authorId: rev.authorId,
		authorName: names.get(rev.authorId) ?? null,
	}));
}

async function findRevision(
	collectionId: Types.ObjectId,
	revisionId: string,
): Promise<StoredRevision> {
	const _id = toObjectId(revisionId);
	const rev = _id
		? await CollectionRevisionModel.findOne({
				_id,
				collectionId,
			}).lean<StoredRevision>()
		: null;
	if (!rev) throw revisionNotFound();
	return rev;
}

/**
 * The changed entity before and after one change (any role): its current
 * state rewound through the later changes that touched it. Work per call
 * is bounded by the changelog's own limits: at most
 * `CHANGELOG_REVISIONS_MAX` later revisions and `REVISIONS_BYTES_MAX`
 * bytes of patches, applied to one entity. A hidden change shows its
 * diff to Editors only (with `hidden: true`, so the client can say it is
 * hidden from Viewers); a trimmed one, or one whose patches (or a later
 * one's) were not kept shows no diff; database errors surface as 500. A "Restore to this change" also
 * lists the nodes it rewrote (`affected`).
 */
export async function revisionDiff(
	sub: string,
	id: string,
	revisionId: string,
): Promise<ChangelogDiff> {
	const { collectionId, role } = await requireCollection(sub, id, "view");
	const rev = await findRevision(collectionId, revisionId);
	const seesHidden = elementRoleAllows("collection", role, "edit");
	const none = {
		revisionId,
		hidden: rev.hidden,
		available: false,
		before: null,
		after: null,
	};
	if ((rev.hidden && !seesHidden) || rev.partial || rev.trimmed) return none;
	const entity = rev.entity === "collection" ? "root" : rev.entityId;
	const later = await CollectionRevisionModel.find(
		{ collectionId, touched: entity, seq: { $gt: rev.seq } },
		{ inverse: 1, partial: 1 },
	)
		.sort({ seq: -1 })
		.limit(CHANGELOG_REVISIONS_MAX)
		.lean<Pick<StoredRevision, "inverse" | "partial">[]>();
	if (later.some((row) => row.partial)) return none;
	const slice = await loadEntitySlice(collectionId, entity);
	const affected =
		rev.action === "restore"
			? await affectedNodes(collectionId, rev.forward, rev.inverse)
			: undefined;
	let before: unknown;
	let after: unknown;
	try {
		for (const row of later) applyInPlace(slice, opsOf(row.inverse, entity));
		after = structuredClone(entityIn(slice, entity));
		applyInPlace(slice, opsOf(rev.inverse, entity));
		before = entityIn(slice, entity);
	} catch {
		// Patches that no longer fit the current state (cannot rewind).
		return none;
	}
	return {
		...none,
		available: true,
		before,
		after,
		...(affected ? { affected } : {}),
	};
}

/** Hides or shows the diff of one change (Editor); it stays in the list. */
export async function setRevisionHidden(
	sub: string,
	id: string,
	revisionId: string,
	hidden: boolean,
): Promise<ChangelogChange> {
	const { collectionId } = await requireCollection(sub, id, "edit");
	const _id = toObjectId(revisionId);
	const rev = _id
		? await CollectionRevisionModel.findOneAndUpdate(
				{ _id, collectionId, trimmed: { $ne: true } },
				{ $set: { hidden } },
				{ projection: META, returnDocument: "after" },
			).lean<RevisionMeta>()
		: null;
	if (!rev) throw revisionNotFound();
	return toChange(rev, await newestPartialSeq(collectionId));
}
