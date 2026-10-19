import { CHANGELOG_REVISIONS_MAX } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { currentChannel } from "../../lib/call-channel.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import { type RevisionInput, builtRevision } from "./revision-patch.js";
import { sessionToJoin } from "./revision-session.js";

/**
 * Patch bytes the changelog of one collection keeps (with at most
 * `CHANGELOG_REVISIONS_MAX` revisions); the oldest revisions go first.
 * Mirrors the content budget, so history cannot outgrow it by far.
 */
export const REVISIONS_BYTES_MAX = 20 * 1024 * 1024;
const TRIM_BATCH = 200;
const QUIET_WHEN_EMPTY: ReadonlySet<string> = new Set(["update", "move"]);

/** The root's changelog counters, read in the write's transaction. */
export interface RevisionCounters {
	readonly revisionSeq?: number;
	readonly revisionCount?: number;
	readonly revisionBytes?: number;
}

/** What `appendRevisions` adds to the root's counters. */
export interface RevisionIncrements {
	readonly revisionSeq: number;
	readonly revisionCount: number;
	readonly revisionBytes: number;
}

/**
 * Writes the revisions of one change in its transaction, numbered after
 * the root's `revisionSeq` (the caller adds the returned increments to
 * the root in the same transaction).
 */
export async function appendRevisions(
	collectionId: Types.ObjectId,
	authorId: string,
	session: ClientSession,
	counters: RevisionCounters,
	drafts: readonly RevisionInput[],
): Promise<RevisionIncrements> {
	// An edit or a drop that changed nothing leaves no entry.
	const built = drafts
		.map(builtRevision)
		.filter(
			(rev) =>
				rev.forward.length > 0 ||
				rev.partial ||
				!QUIET_WHEN_EMPTY.has(rev.action),
		);
	if (built.length === 0) {
		return { revisionSeq: 0, revisionCount: 0, revisionBytes: 0 };
	}
	const first = (counters.revisionSeq ?? 0) + 1;
	const at = new Date();
	const via = currentChannel();
	const start = (await sessionToJoin(
		collectionId,
		{ authorId, via },
		at,
		session,
	)) ?? {
		seq: first,
		at,
	};
	await CollectionRevisionModel.insertMany(
		built.map((revision, index) => ({
			...revision,
			collectionId,
			seq: first + index,
			authorId,
			at,
			sessionStartSeq: start.seq,
			sessionStartAt: start.at,
			...(via ? { via } : {}),
		})),
		{ session },
	);
	return {
		revisionSeq: built.length,
		revisionCount: built.length,
		revisionBytes: built.reduce((sum, revision) => sum + revision.bytes, 0),
	};
}

/** Trimmed revisions remembered (as stubs) per collection. */
const STUBS_MAX = CHANGELOG_REVISIONS_MAX;

/**
 * Trims the oldest revisions while the changelog holds more than
 * `CHANGELOG_REVISIONS_MAX` revisions or `REVISIONS_BYTES_MAX` bytes, in
 * the caller's transaction, and lowers the root's counters to match. A
 * trimmed revision stays as a stub without patches (`trimmed`), so a
 * restore to it answers 409 rather than 404; the oldest stubs past
 * `STUBS_MAX` are deleted.
 */
export async function trimRevisions(
	collectionId: Types.ObjectId,
	session: ClientSession,
	count: number,
	bytes: number,
): Promise<void> {
	let left = { count, bytes };
	const over = () =>
		left.count > CHANGELOG_REVISIONS_MAX || left.bytes > REVISIONS_BYTES_MAX;
	while (over()) {
		const oldest = await CollectionRevisionModel.find(
			{ collectionId, trimmed: { $ne: true } },
			{ bytes: 1 },
		)
			.session(session)
			.sort({ seq: 1 })
			.limit(TRIM_BATCH)
			.lean<{ _id: Types.ObjectId; bytes: number }[]>();
		if (oldest.length === 0) break;
		const drop: Types.ObjectId[] = [];
		for (const row of oldest) {
			if (!over()) break;
			drop.push(row._id);
			left = { count: left.count - 1, bytes: left.bytes - row.bytes };
		}
		await CollectionRevisionModel.updateMany(
			{ _id: { $in: drop } },
			{
				$set: {
					trimmed: true,
					forward: [],
					inverse: [],
					partial: false,
					bytes: 0,
				},
			},
			{ session },
		);
	}
	if (left.count === count) return;
	await CollectionModel.updateOne(
		{ _id: collectionId },
		{
			$inc: {
				revisionCount: left.count - count,
				revisionBytes: left.bytes - bytes,
			},
		},
		{ session },
	);
	const extra = await CollectionRevisionModel.find(
		{ collectionId, trimmed: true },
		{ _id: 1 },
	)
		.session(session)
		.sort({ seq: -1 })
		.skip(STUBS_MAX)
		.limit(TRIM_BATCH)
		.lean<{ _id: Types.ObjectId }[]>();
	if (extra.length > 0) {
		await CollectionRevisionModel.deleteMany(
			{ _id: { $in: extra.map((row) => row._id) } },
			{ session },
		);
	}
}
