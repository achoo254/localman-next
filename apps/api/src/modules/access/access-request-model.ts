import {
	ELEMENT_ROLES,
	type ElementRole,
	SHAREABLE_ELEMENT_TYPES,
	type ShareableElementType,
} from "@localman/shared/access";
import mongoose, { Schema, type Types } from "mongoose";

export type AccessRequestStatus = "pending" | "approved" | "denied";

/** Resolved requests are purged this long after they were resolved. */
const RESOLVED_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/**
 * "Request access" (Viewer) or "Request to edit" (Editor) on an element.
 * Its Editors are notified and approve or deny; the requester hears back
 * the same way. One pending request per person and element.
 */
const accessRequestSchema = new Schema(
	{
		elementType: {
			type: String,
			enum: SHAREABLE_ELEMENT_TYPES,
			required: true,
		},
		elementId: { type: String, required: true },
		requesterId: { type: String, required: true },
		role: { type: String, enum: ELEMENT_ROLES, required: true },
		message: { type: String, trim: true, maxlength: 500 },
		status: {
			type: String,
			enum: ["pending", "approved", "denied"],
			required: true,
		},
		resolvedBy: { type: String },
		resolvedAt: { type: Date },
	},
	{ collection: "access_requests", timestamps: true, versionKey: false },
);
accessRequestSchema.index(
	{ elementType: 1, elementId: 1, requesterId: 1 },
	{ unique: true, partialFilterExpression: { status: "pending" } },
);
accessRequestSchema.index({ elementType: 1, elementId: 1, status: 1 });
accessRequestSchema.index(
	{ resolvedAt: 1 },
	{
		expireAfterSeconds: RESOLVED_RETENTION_SECONDS,
		partialFilterExpression: { resolvedAt: { $exists: true } },
	},
);

export const AccessRequestModel = mongoose.model(
	"AccessRequest",
	accessRequestSchema,
);

export interface StoredAccessRequest {
	readonly _id: Types.ObjectId;
	readonly elementType: ShareableElementType;
	readonly elementId: string;
	readonly requesterId: string;
	readonly role: ElementRole;
	readonly message?: string | null;
	readonly status: AccessRequestStatus;
	readonly resolvedBy?: string | null;
	readonly resolvedAt?: Date | null;
	readonly createdAt: Date;
}
