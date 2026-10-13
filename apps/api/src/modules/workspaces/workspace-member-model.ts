import { WORKSPACE_ROLES, type WorkspaceRole } from "@localman/shared/access";
import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

export type WorkspaceMemberStatus = "pending" | "accepted";

/** Pending invitations are purged this long after they expired. */
const EXPIRED_INVITE_RETENTION_SECONDS = 30 * 24 * 60 * 60;

/**
 * A member of a team workspace, or an invitation to become one, with the
 * role it grants. Invitations work like project invitations: addressed to
 * an account (`userId`) or to an email only an IdP-verified email can
 * claim (`email`, lower-case), or neither for a one-use link. Only the
 * SHA-256 of the invite token is stored. Accepting sets `status:
 * "accepted"` and `userId`. Personal workspaces have no member rows.
 */
const workspaceMemberSchema = new Schema(
	{
		workspaceId: { type: Schema.Types.ObjectId, required: true },
		userId: { type: String },
		email: { type: String },
		role: { type: String, enum: WORKSPACE_ROLES, required: true },
		status: { type: String, enum: ["pending", "accepted"], required: true },
		inviteTokenHash: { type: String },
		/** Expiry of the invitation; kept after acceptance, then unused. */
		expiresAt: { type: Date },
		/** `sub` of the Admin who invited (the creator for the first Admin). */
		invitedBy: { type: String, required: true },
		acceptedAt: { type: Date },
	},
	{ collection: "workspace_members", timestamps: true, versionKey: false },
);
// Partial on `$exists`, as in `collaborator-model.ts`: identity fields are
// always `$unset`, never set to null.
workspaceMemberSchema.index(
	{ workspaceId: 1, userId: 1 },
	{ unique: true, partialFilterExpression: { userId: { $exists: true } } },
);
workspaceMemberSchema.index(
	{ workspaceId: 1, email: 1 },
	{ unique: true, partialFilterExpression: { email: { $exists: true } } },
);
workspaceMemberSchema.index(
	{ inviteTokenHash: 1 },
	{
		unique: true,
		partialFilterExpression: { inviteTokenHash: { $exists: true } },
	},
);
workspaceMemberSchema.index({ workspaceId: 1, status: 1 });
workspaceMemberSchema.index({ userId: 1, status: 1 });
workspaceMemberSchema.index(
	{ expiresAt: 1 },
	{
		expireAfterSeconds: EXPIRED_INVITE_RETENTION_SECONDS,
		partialFilterExpression: { status: "pending" },
	},
);

workspaceMemberSchema.plugin(tenantScopePlugin);
export const WorkspaceMemberModel = mongoose.model(
	"WorkspaceMember",
	workspaceMemberSchema,
);

export interface StoredWorkspaceMember {
	readonly _id: Types.ObjectId;
	readonly workspaceId: Types.ObjectId;
	readonly userId?: string | null;
	readonly email?: string | null;
	readonly role: WorkspaceRole;
	readonly status: WorkspaceMemberStatus;
	readonly inviteTokenHash?: string | null;
	readonly expiresAt?: Date | null;
	readonly invitedBy: string;
	readonly acceptedAt?: Date | null;
	readonly createdAt: Date;
}
