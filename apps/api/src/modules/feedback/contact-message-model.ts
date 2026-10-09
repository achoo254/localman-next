import {
	CONTACT_CATEGORIES,
	CONTACT_SOURCES,
	CONTACT_STATUSES,
	type ContactCategory,
	type ContactSource,
	type ContactStatus,
} from "@localman/shared";
import mongoose, { Schema, type Types } from "mongoose";

/**
 * Messages left through the "Góp ý / Liên hệ" form. They share the
 * `feedback` collection with Pro-interest entries (`type: "contact"`) but
 * have their own model, so neither type's required fields or indexes
 * leak into the other; every query filters on `type`.
 */
const contactMessageSchema = new Schema(
	{
		type: { type: String, enum: ["contact"], required: true },
		category: { type: String, enum: CONTACT_CATEGORIES, required: true },
		message: { type: String, required: true },
		name: { type: String },
		/** Email (lower-cased) or Telegram `@username` to reply to. */
		contact: { type: String },
		contactKind: { type: String, enum: ["email", "telegram"] },
		source: { type: String, enum: CONTACT_SOURCES, required: true },
		/** Set when the sender was signed in. */
		userSub: { type: String },
		status: {
			type: String,
			enum: CONTACT_STATUSES,
			required: true,
			default: "new",
		},
		readAt: { type: Date },
		resolvedAt: { type: Date },
	},
	{ collection: "feedback", timestamps: true, versionKey: false },
);
contactMessageSchema.index({ type: 1, status: 1, createdAt: -1 });

export const ContactMessageModel = mongoose.model(
	"ContactMessage",
	contactMessageSchema,
);

export interface StoredContactMessage {
	readonly _id: Types.ObjectId;
	readonly category: ContactCategory;
	readonly message: string;
	readonly name?: string | null;
	readonly contact?: string | null;
	readonly contactKind?: "email" | "telegram" | null;
	readonly source: ContactSource;
	readonly userSub?: string | null;
	readonly status: ContactStatus;
	readonly readAt?: Date | null;
	readonly resolvedAt?: Date | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
