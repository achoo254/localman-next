import type { ClientSession, Types } from "mongoose";
import { elementNotFound } from "../access/access-policy.js";
import {
	COLLECTION_BYTES_MAX,
	collectionTooLarge,
} from "./collection-bytes.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";
import {
	type RevisionCounters,
	appendRevisions,
	trimRevisions,
} from "./revision-log.js";
import type { RevisionInput } from "./revision-patch.js";

export interface RootChange {
	/** Change of `bytes` (negative when content goes). */
	readonly bytes?: number;
	/** Change of `requestCount`. */
	readonly requests?: number;
	/** Root fields written along (a root edit). */
	readonly set?: Readonly<Record<string, unknown>>;
	/** The changelog entries of this change (drafts, or built to check first). */
	readonly revisions?: readonly RevisionInput[];
}

type RootCounters = RevisionCounters & { readonly bytes?: number };

/**
 * Applies a change to the live root inside the caller's transaction:
 * stamps who changed the collection last, keeps `bytes` and
 * `requestCount`, and records the change's revisions (trimming the oldest
 * past the changelog limits). Writing the root also makes a concurrent
 * trash or purge of it conflict with this transaction. 404 when the
 * collection is gone or trashed, 413 `COLLECTION_TOO_LARGE` when the
 * change would grow it past `COLLECTION_BYTES_MAX`.
 */
export async function chargeRoot(
	collectionId: Types.ObjectId,
	sub: string,
	session: ClientSession,
	change: RootChange = {},
): Promise<void> {
	const filter = { _id: collectionId, ...LIVE_COLLECTION };
	const root = await CollectionModel.findOne(filter, {
		bytes: 1,
		revisionSeq: 1,
		revisionCount: 1,
		revisionBytes: 1,
	})
		.session(session)
		.lean<RootCounters>();
	if (!root) throw elementNotFound();
	const delta = change.bytes ?? 0;
	const next = (root.bytes ?? 0) + delta;
	if (delta > 0 && next > COLLECTION_BYTES_MAX) throw collectionTooLarge(next);
	const added = await appendRevisions(
		collectionId,
		sub,
		session,
		root,
		change.revisions ?? [],
	);
	await CollectionModel.updateOne(
		filter,
		{
			$set: { ...change.set, updatedBy: sub },
			$inc: { bytes: delta, requestCount: change.requests ?? 0, ...added },
		},
		{ session },
	);
	if (added.revisionCount > 0) {
		await trimRevisions(
			collectionId,
			session,
			(root.revisionCount ?? 0) + added.revisionCount,
			(root.revisionBytes ?? 0) + added.revisionBytes,
		);
	}
}
