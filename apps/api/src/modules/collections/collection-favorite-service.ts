import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { CollectionFavoriteModel } from "./collection-favorite-model.js";

/** Stars or unstars the collection for `sub` alone. */
export async function setFavorite(
	sub: string,
	collectionId: Types.ObjectId,
	favorite: boolean,
): Promise<void> {
	const key = { userId: sub, collectionId };
	if (!favorite) {
		await CollectionFavoriteModel.deleteOne(key);
		return;
	}
	// An upsert racing another one for the same key may hit the unique index.
	try {
		await CollectionFavoriteModel.updateOne(
			key,
			{ $setOnInsert: key },
			{ upsert: true },
		);
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
	}
}
