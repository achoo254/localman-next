import mongoose, { Schema, type Types } from "mongoose";

/**
 * The reusable join link of a project: anyone signed in who opens it
 * becomes an accepted collaborator (within the owner's member limit). One
 * document per project, so a project never has two working links: creating
 * a new link replaces the token hash (the old link stops working) and
 * revoking sets `revokedAt`. Only the SHA-256 of the token is stored.
 */
const magicLinkSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true, unique: true },
		tokenHash: { type: String, required: true, unique: true },
		expiresAt: { type: Date, required: true },
		revokedAt: { type: Date, default: null },
		/** When the current token was created (each replacement resets it). */
		issuedAt: { type: Date, required: true },
		/** `sub` of the owner who created the current link. */
		createdBy: { type: String, required: true },
	},
	{ collection: "magic_links", timestamps: true, versionKey: false },
);

export const MagicLinkModel = mongoose.model("MagicLink", magicLinkSchema);

export interface StoredMagicLink {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly tokenHash: string;
	readonly expiresAt: Date;
	readonly revokedAt: Date | null;
	readonly createdBy: string;
	readonly issuedAt: Date;
}
