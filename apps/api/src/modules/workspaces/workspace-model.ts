import {
	WORKSPACE_TYPES,
	WORKSPACE_VISIBILITIES,
	type WorkspaceType,
	type WorkspaceVisibility,
} from "@localman/shared/access";
import type { WorkspaceSharingSettings } from "@localman/shared/api-client";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A place for collections and environments. Every user has exactly one
 * personal workspace (only they see it), created on first use; team
 * workspaces have members with a role each (`workspace-member-model.ts`).
 * `ownerId` is the creator: the personal workspace's user, or the team
 * workspace's first Admin, whose plan bounds the members. `sharing`
 * holds the Admin's switches of public sharing; a document written before
 * them reads as all on (`sharingSettingsOf`).
 */
const workspaceSchema = new Schema(
	{
		name: { type: String, required: true, trim: true, maxlength: 100 },
		description: { type: String, trim: true, maxlength: 1000 },
		type: { type: String, enum: WORKSPACE_TYPES, required: true },
		visibility: { type: String, enum: WORKSPACE_VISIBILITIES, required: true },
		ownerId: { type: String, required: true },
		sharing: {
			publicLinksAllowed: { type: Boolean },
			guestsAllowed: { type: Boolean },
			accessKeysAllowed: { type: Boolean },
		},
	},
	{ collection: "workspaces", timestamps: true, versionKey: false },
);
// One personal workspace per user, even when two requests create it at once.
workspaceSchema.index(
	{ ownerId: 1 },
	{ unique: true, partialFilterExpression: { type: "personal" } },
);
workspaceSchema.index({ ownerId: 1, type: 1 });

workspaceSchema.plugin(tenantScopePlugin);
export const WorkspaceModel = mongoose.model("Workspace", workspaceSchema);

export interface StoredWorkspace {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly description?: string | null;
	readonly type: WorkspaceType;
	readonly visibility: WorkspaceVisibility;
	readonly ownerId: string;
	readonly sharing?: Partial<WorkspaceSharingSettings> | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
