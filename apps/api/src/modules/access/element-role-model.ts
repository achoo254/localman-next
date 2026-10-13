import {
	ELEMENT_ROLES,
	type ElementRole,
	SHAREABLE_ELEMENT_TYPES,
	type ShareableElementType,
} from "@localman/shared/access";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A role on one element (collection or environment) given to one person,
 * on top of what their workspace role gives (it can only raise it). Shared
 * with an account (`userId`) or with an email that has no account yet
 * (`email`, lower-case), which the account with that IdP-verified email
 * claims on first sign-in. Requests and examples inherit the collection's.
 */
const elementRoleSchema = new Schema(
	{
		elementType: {
			type: String,
			enum: SHAREABLE_ELEMENT_TYPES,
			required: true,
		},
		elementId: { type: String, required: true },
		userId: { type: String },
		email: { type: String },
		role: { type: String, enum: ELEMENT_ROLES, required: true },
		grantedBy: { type: String, required: true },
	},
	{ collection: "element_roles", timestamps: true, versionKey: false },
);
elementRoleSchema.index(
	{ elementType: 1, elementId: 1, userId: 1 },
	{ unique: true, partialFilterExpression: { userId: { $exists: true } } },
);
elementRoleSchema.index(
	{ elementType: 1, elementId: 1, email: 1 },
	{ unique: true, partialFilterExpression: { email: { $exists: true } } },
);
elementRoleSchema.index({ userId: 1, elementType: 1 });
// Manage access lists an element's shares oldest first.
elementRoleSchema.index({ elementType: 1, elementId: 1, createdAt: 1 });

elementRoleSchema.plugin(tenantScopePlugin);
export const ElementRoleModel = mongoose.model(
	"ElementRole",
	elementRoleSchema,
);

export interface StoredElementRole {
	readonly _id: Types.ObjectId;
	readonly elementType: ShareableElementType;
	readonly elementId: string;
	readonly userId?: string | null;
	readonly email?: string | null;
	readonly role: ElementRole;
	readonly grantedBy: string;
	readonly createdAt: Date;
}
