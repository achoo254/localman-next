import type { Types } from "mongoose";
import type { Logger } from "../../logger.js";
import { elementRoleOf } from "../access/access-policy.js";
import { elementPath } from "../access/element-access-view.js";
import type { ElementRecord } from "../access/element-adapters.js";
import {
	CollectionModel,
	LIVE_COLLECTION,
	type StoredCollection,
} from "../collections/collection-model.js";
import { CollectionRevisionModel } from "../collections/collection-revision-model.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import { displayNames } from "../users/display-names.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { CollectionWatchModel, type StoredWatch } from "./watch-model.js";

/** Watches read per page; a run goes through them all. */
const PAGE = 500;

type WatchedRoot = Pick<
	StoredCollection,
	"_id" | "name" | "workspaceId" | "revisionSeq"
>;
type Change = { seq: number; authorId: string };

/** The changes since `after` made by someone else than `sub`. */
const othersSince = (changes: readonly Change[], after: number, sub: string) =>
	changes.filter((change) => change.seq > after && change.authorId !== sub);

/**
 * Moves the watch to `seq`; `false` when another run already did (the
 * caller then sends nothing, so a watcher is told once).
 */
async function advance(watch: StoredWatch, seq: number): Promise<boolean> {
	const moved = await CollectionWatchModel.updateOne(
		{ _id: watch._id, lastSeq: watch.lastSeq },
		{ $set: { lastSeq: seq } },
	);
	return moved.modifiedCount === 1;
}

async function tell(
	watch: StoredWatch,
	element: ElementRecord,
	changes: readonly Change[],
): Promise<void> {
	const authors = [...new Set(changes.map((change) => change.authorId))];
	const only = authors.length === 1 ? authors[0] : undefined;
	const author =
		only === undefined
			? null
			: ((await displayNames([only])).get(only) ?? null);
	getNotificationService().notifyLater(watch.userId, {
		type: "collection.changed",
		params: {
			collection: element.name,
			changes: changes.length,
			authors: authors.length,
			author,
		},
		link: elementPath(element),
	});
}

/** Digests the watches of one live collection that changed. */
async function digestCollection(
	root: WatchedRoot,
	watches: readonly StoredWatch[],
): Promise<number> {
	const seq = root.revisionSeq ?? 0;
	const behind = watches.filter((watch) => watch.lastSeq < seq);
	if (behind.length === 0) return 0;
	const workspace = await findWorkspaceById(root.workspaceId.toHexString());
	const element: ElementRecord = {
		type: "collection",
		id: root._id.toHexString(),
		name: root.name,
		workspaceId: root.workspaceId,
	};
	const from = Math.min(...behind.map((watch) => watch.lastSeq));
	const changes = await CollectionRevisionModel.find(
		{ collectionId: root._id, seq: { $gt: from, $lte: seq } },
		{ seq: 1, authorId: 1 },
	).lean<Change[]>();
	let told = 0;
	for (const watch of behind) {
		const others = othersSince(changes, watch.lastSeq, watch.userId);
		const allowed =
			workspace?.type === "team" &&
			(await elementRoleOf(watch.userId, element, { claim: false })) !== null;
		if (!allowed) {
			// Left the team or lost the share: no more news about it.
			await CollectionWatchModel.deleteOne({ _id: watch._id });
			continue;
		}
		if (!(await advance(watch, seq)) || others.length === 0) continue;
		await tell(watch, element, others);
		told += 1;
	}
	return told;
}

/**
 * Tells every watcher, once per collection, about the changes others made
 * since they were last told; their own changes only move them forward.
 * Trashed collections wait (their watches stay). Returns how many were
 * told.
 */
export async function digestWatches(logger: Logger): Promise<number> {
	let told = 0;
	let after: Types.ObjectId | null = null;
	for (;;) {
		const page: StoredWatch[] = await CollectionWatchModel.find(
			after === null ? {} : { _id: { $gt: after } },
		)
			.sort({ _id: 1 })
			.limit(PAGE)
			.lean<StoredWatch[]>();
		const last = page.at(-1);
		if (last === undefined) break;
		after = last._id;
		const ids = [
			...new Set(page.map((watch) => watch.collectionId.toHexString())),
		];
		const roots = await CollectionModel.find(
			{ _id: { $in: ids }, ...LIVE_COLLECTION },
			{ name: 1, workspaceId: 1, revisionSeq: 1 },
		).lean<WatchedRoot[]>();
		for (const root of roots) {
			const watches = page.filter((watch) =>
				watch.collectionId.equals(root._id),
			);
			try {
				told += await digestCollection(root, watches);
			} catch (error) {
				logger.error(
					{ err: error, collectionId: root._id.toHexString() },
					"Watch digest failed",
				);
			}
		}
	}
	return told;
}
