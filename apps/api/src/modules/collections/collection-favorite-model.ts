import mongoose, { Schema } from "mongoose";

/** A collection one user starred: it comes first in their sidebar. */
const collectionFavoriteSchema = new Schema(
	{
		userId: { type: String, required: true },
		collectionId: { type: Schema.Types.ObjectId, required: true },
	},
	{ collection: "collection_favorites", timestamps: true, versionKey: false },
);
collectionFavoriteSchema.index(
	{ userId: 1, collectionId: 1 },
	{ unique: true },
);
collectionFavoriteSchema.index({ collectionId: 1 });

export const CollectionFavoriteModel = mongoose.model(
	"CollectionFavorite",
	collectionFavoriteSchema,
);
