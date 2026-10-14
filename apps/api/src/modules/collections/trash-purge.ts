import type { TrashedCollectionSummary } from "@localman/shared/api-client";
import mongoose, { type Types } from "mongoose";
import { AccessRequestModel } from "../access/access-request-model.js";
import { ElementRoleModel } from "../access/element-role-model.js";
import { deleteScopeLocalValues } from "../environments/local-values.js";
import { collectionScope } from "../environments/scope-local-service.js";
import { CollectionAccessKeyModel } from "../public-sharing/collection-access-key-model.js";
import { CollectionLinkModel } from "../public-sharing/collection-link-model.js";
import { RunButtonModel } from "../public-sharing/run-button-model.js";
import { CollectionFavoriteModel } from "./collection-favorite-model.js";
import { CollectionModel } from "./collection-model.js";
import { CollectionNodeModel } from "./collection-node-model.js";
import { CollectionRevisionModel } from "./collection-revision-model.js";
import { IN_TRASH, notInTrash, requireTrashed } from "./trash-access.js";
import { toTrashedViews } from "./trash-view.js";

/**
 * Deletes a trashed collection for good, with its nodes, changelog,
 * favorites, shares, access requests, public and guest links, access
 * keys, Run buttons and
 * everyone's local values of its variables, in one transaction. `trashed` narrows which
 * trashed state still qualifies (the job passes its age cutoff), so a
 * collection restored meanwhile is left alone. `false` when nothing
 * matched.
 */
export async function purgeCollection(
	collectionId: Types.ObjectId,
	trashed: Record<string, unknown> = IN_TRASH,
): Promise<boolean> {
	return mongoose.connection.transaction(async (session) => {
		const root = await CollectionModel.deleteOne(
			{ ...trashed, _id: collectionId },
			{ session },
		);
		if (root.deletedCount === 0) return false;
		const element = {
			elementType: "collection" as const,
			elementId: collectionId.toHexString(),
		};
		await CollectionNodeModel.deleteMany({ collectionId }, { session });
		await CollectionRevisionModel.deleteMany({ collectionId }, { session });
		await CollectionFavoriteModel.deleteMany({ collectionId }, { session });
		await ElementRoleModel.deleteMany(element, { session });
		await AccessRequestModel.deleteMany(element, { session });
		await CollectionLinkModel.deleteMany({ collectionId }, { session });
		await CollectionAccessKeyModel.deleteMany({ collectionId }, { session });
		await RunButtonModel.deleteMany({ collectionId }, { session });
		await deleteScopeLocalValues([collectionScope(collectionId)], session);
		return true;
	});
}

export interface PermanentDeletion {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	readonly collection: TrashedCollectionSummary;
	readonly nodes: number;
}

/**
 * Deletes a trashed collection for good (whoever may restore it); the dry
 * run shows it and how many folders and requests go with it.
 */
export async function deletePermanently(
	sub: string,
	id: string,
	dryRun: boolean,
): Promise<PermanentDeletion> {
	const { trashed } = await requireTrashed(sub, id);
	const [[collection], nodes] = await Promise.all([
		toTrashedViews([trashed]),
		CollectionNodeModel.countDocuments({ collectionId: trashed._id }),
	]);
	if (!collection) throw new Error("Trashed collection has no view");
	// Restored or purged since it was read: say so instead of claiming it.
	if (!dryRun && !(await purgeCollection(trashed._id))) throw notInTrash();
	return { dryRun, deleted: !dryRun, collection, nodes };
}
