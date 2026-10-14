/**
 * Reading a collection with an access key. Every failure answers the same
 * 401, so a key's state never leaks: unknown key, key of another
 * collection, unused for 60 days, creator no longer an Admin or Editor
 * member of the collection's workspace, access keys turned off there,
 * collection trashed or gone.
 */
import { OperationError } from "@localman/operations";
import { Types } from "mongoose";
import { hashToken } from "../../lib/prefixed-token.js";
import type { StoredCollection } from "../collections/collection-model.js";
import { findLiveCollection } from "../collections/collection-store.js";
import {
	ACCESS_KEY_PREFIX,
	CollectionAccessKeyModel,
	type StoredAccessKey,
} from "./collection-access-key-model.js";
import { takeAccessKeySlot } from "./public-sharing-limits.js";
import { stillServable } from "./publish-access.js";

const DAY_MS = 24 * 60 * 60 * 1000;
/** A key unused this long stops working. */
export const ACCESS_KEY_IDLE_MS = 60 * DAY_MS;
/** `lastUsedAt` is written at most this often, not on every read. */
const LAST_USED_STEP_MS = 60 * 60 * 1000;

export function expiresAt(
	key: Pick<StoredAccessKey, "lastUsedAt" | "createdAt">,
): Date {
	const from = key.lastUsedAt ?? key.createdAt;
	return new Date(from.getTime() + ACCESS_KEY_IDLE_MS);
}

function invalidKey(): OperationError {
	return new OperationError(
		401,
		"ACCESS_KEY_INVALID",
		"The access key is invalid or expired",
	);
}

/** The live collection the key opens; the caller counted the IP before. */
export async function collectionForKey(
	collectionId: string,
	presented: string | undefined,
	now: Date = new Date(),
): Promise<StoredCollection> {
	if (!presented?.startsWith(ACCESS_KEY_PREFIX)) throw invalidKey();
	if (!Types.ObjectId.isValid(collectionId)) throw invalidKey();
	const key = await CollectionAccessKeyModel.findOne({
		keyHash: hashToken(presented),
	}).lean<StoredAccessKey>();
	if (!key || key.collectionId.toHexString() !== collectionId) {
		throw invalidKey();
	}
	if (expiresAt(key) <= now) throw invalidKey();
	const collection = await findLiveCollection(key.collectionId);
	if (!collection) throw invalidKey();
	if (!(await stillServable(key.userId, collection, "accessKeysAllowed"))) {
		throw invalidKey();
	}
	// Only a key that matched gets a counter: guesses never create one.
	await takeAccessKeySlot(key._id.toHexString());
	const last = key.lastUsedAt?.getTime() ?? 0;
	if (now.getTime() - last >= LAST_USED_STEP_MS) {
		// Bookkeeping of the key, not of the collection it reads.
		await CollectionAccessKeyModel.updateOne(
			{ _id: key._id },
			{ $set: { lastUsedAt: now } },
		);
	}
	return collection;
}
