import { OperationError } from "@localman/operations";
import type { CollectionWatchView } from "@localman/shared/api-client";
import type { CollectionAccess } from "../collections/collection-access.js";
import {
	CollectionModel,
	type StoredCollection,
} from "../collections/collection-model.js";
import { findWorkspaceById } from "../workspaces/workspace-roles.js";
import { CollectionWatchModel } from "./watch-model.js";

/** Watching needs a team workspace: in a personal one nobody else edits. */
async function watchAvailable(access: CollectionAccess): Promise<boolean> {
	const workspace = await findWorkspaceById(
		access.element.workspaceId.toHexString(),
	);
	return workspace?.type === "team";
}

export async function getWatch(
	access: CollectionAccess,
	sub: string,
): Promise<CollectionWatchView> {
	const [available, row] = await Promise.all([
		watchAvailable(access),
		CollectionWatchModel.exists({
			collectionId: access.collectionId,
			userId: sub,
		}),
	]);
	return {
		collectionId: access.element.id,
		watching: available && row !== null,
		available,
	};
}

/**
 * Starts or stops watching (idempotent). A new watch starts at the
 * current changelog revision, so earlier changes are not reported.
 * 409 `WATCH_UNAVAILABLE` in a personal workspace.
 */
export async function setWatch(
	access: CollectionAccess,
	sub: string,
	watching: boolean,
): Promise<CollectionWatchView> {
	const key = { collectionId: access.collectionId, userId: sub };
	if (!watching) {
		await CollectionWatchModel.deleteOne(key);
		return {
			collectionId: access.element.id,
			watching: false,
			available: await watchAvailable(access),
		};
	}
	if (!(await watchAvailable(access))) {
		throw new OperationError(
			409,
			"WATCH_UNAVAILABLE",
			"Only collections of a team workspace can be watched",
		);
	}
	const root = await CollectionModel.findById(access.collectionId, {
		revisionSeq: 1,
	}).lean<Pick<StoredCollection, "revisionSeq">>();
	await CollectionWatchModel.updateOne(
		key,
		{ $setOnInsert: { lastSeq: root?.revisionSeq ?? 0 } },
		{ upsert: true },
	);
	return { collectionId: access.element.id, watching: true, available: true };
}
