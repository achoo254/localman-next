/**
 * Public and guest links of a collection: turn on (one per kind, the same
 * one while it stays on), read, turn off (delete), and serve. Serving
 * answers the same 404 whatever failed (unknown id, link off, collection
 * trashed or gone, creator no longer an Admin or Editor member, switch
 * off), so a link's state never leaks.
 */
import { OperationError } from "@localman/operations";
import type {
	CollectionLinkKind,
	WorkspaceSharingSwitch,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import type { StoredCollection } from "../collections/collection-model.js";
import { findLiveCollection } from "../collections/collection-store.js";
import { isCapabilityId, newCapabilityId } from "./capability-id.js";
import {
	CollectionLinkModel,
	type StoredCollectionLink,
} from "./collection-link-model.js";
import { canPublish, stillServable } from "./publish-access.js";

const LINK_ID_BYTES = 32;

const SWITCH_OF: Record<CollectionLinkKind, WorkspaceSharingSwitch> = {
	public: "publicLinksAllowed",
	guest: "guestsAllowed",
};

const PAGE_OF: Record<CollectionLinkKind, string> = {
	public: "public/c",
	guest: "guest",
};

export interface CollectionLinkView {
	kind: CollectionLinkKind;
	url: string;
	createdBy: string;
	createdAt: string;
}

export function toLinkView(link: StoredCollectionLink): CollectionLinkView {
	const origin = tenantSettings().publicUrl;
	return {
		kind: link.kind,
		url: `${origin}/${PAGE_OF[link.kind]}/${link.linkId}`,
		createdBy: link.createdBy,
		createdAt: link.createdAt.toISOString(),
	};
}

export function findLink(
	collectionId: Types.ObjectId,
	kind: CollectionLinkKind,
): Promise<StoredCollectionLink | null> {
	return CollectionLinkModel.findOne({
		collectionId,
		kind,
	}).lean<StoredCollectionLink>();
}

/**
 * The link of this kind, created when there is none. A link whose creator
 * may no longer publish is never served again, so it is replaced (new
 * address) instead of handed back as if it worked.
 */
export async function enableLink(
	collection: {
		readonly collectionId: Types.ObjectId;
		readonly workspaceId: Types.ObjectId;
	},
	kind: CollectionLinkKind,
	sub: string,
): Promise<StoredCollectionLink> {
	const { collectionId } = collection;
	const existing = await findLink(collectionId, kind);
	if (existing) {
		if (await canPublish(existing.createdBy, collection)) return existing;
		await CollectionLinkModel.deleteOne({ _id: existing._id });
	}
	try {
		const created = await CollectionLinkModel.create({
			collectionId,
			kind,
			linkId: newCapabilityId(LINK_ID_BYTES),
			createdBy: sub,
		});
		return created.toObject<StoredCollectionLink>();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		// Turned on twice at once: both callers get the winner's link.
		const winner = await findLink(collectionId, kind);
		if (!winner) throw error;
		return winner;
	}
}

/** Deletes the link; `false` when there was none. */
export async function disableLink(
	collectionId: Types.ObjectId,
	kind: CollectionLinkKind,
): Promise<boolean> {
	const result = await CollectionLinkModel.deleteOne({ collectionId, kind });
	return result.deletedCount > 0;
}

export function linkNotFound(): OperationError {
	return new OperationError(
		404,
		"PUBLIC_LINK_NOT_FOUND",
		"This link does not exist or was turned off",
	);
}

/** The live collection a link opens, or the one 404 for every failure. */
export async function servedCollection(
	linkId: string,
	kind: CollectionLinkKind,
): Promise<StoredCollection> {
	if (!isCapabilityId(linkId, LINK_ID_BYTES)) throw linkNotFound();
	const link = await CollectionLinkModel.findOne({
		linkId,
		kind,
	}).lean<StoredCollectionLink>();
	if (!link) throw linkNotFound();
	const collection = await findLiveCollection(link.collectionId);
	if (!collection) throw linkNotFound();
	if (!(await stillServable(link.createdBy, collection, SWITCH_OF[kind]))) {
		throw linkNotFound();
	}
	return collection;
}
