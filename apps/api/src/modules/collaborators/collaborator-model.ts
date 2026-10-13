import mongoose, { type PipelineStage, Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

export type CollaboratorStatus = "pending" | "accepted";

/** Pending invitations are purged this long after they expired. */
const EXPIRED_INVITE_RETENTION_SECONDS = 30 * 24 * 60 * 60;

/**
 * A member of a project other than its owner, or an invitation to become
 * one. An invitation is always addressed: bound to the account a username
 * or email matched when it was sent (`inviteeUserId`), or, for someone
 * without an account yet, to an email (`inviteeEmail`, lower-case) that
 * only an IdP-verified email can claim. Only the SHA-256 of the invite
 * token is stored; the token itself is shown once, when it is created.
 * Accepting sets `status: "accepted"` and `inviteeUserId` to the account
 * that accepted. Members who joined through the project's magic link have
 * no invite token.
 */
const collaboratorSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		inviteeUserId: { type: String },
		inviteeEmail: { type: String },
		inviteTokenHash: { type: String },
		/** Expiry of the invitation; kept after acceptance, then unused. */
		expiresAt: { type: Date },
		status: {
			type: String,
			enum: ["pending", "accepted"],
			required: true,
		},
		/** `sub` of the owner who invited (or who created the magic link). */
		invitedBy: { type: String, required: true },
		acceptedAt: { type: Date },
	},
	{ collection: "collaborators", timestamps: true, versionKey: false },
);
// Partial on `$exists`: the planner uses these for equality lookups (a
// `$type` filter is not implied by `field: value`, which left them unused).
// Identity fields are always `$unset`, never set to null.
collaboratorSchema.index(
	{ projectId: 1, inviteeUserId: 1 },
	{
		unique: true,
		partialFilterExpression: { inviteeUserId: { $exists: true } },
	},
);
collaboratorSchema.index(
	{ projectId: 1, inviteeEmail: 1 },
	{
		unique: true,
		partialFilterExpression: { inviteeEmail: { $exists: true } },
	},
);
collaboratorSchema.index(
	{ inviteTokenHash: 1 },
	{
		unique: true,
		partialFilterExpression: { inviteTokenHash: { $exists: true } },
	},
);
collaboratorSchema.index({ projectId: 1, status: 1 });
collaboratorSchema.index({ inviteeUserId: 1, status: 1 });
collaboratorSchema.index(
	{ expiresAt: 1 },
	{
		expireAfterSeconds: EXPIRED_INVITE_RETENTION_SECONDS,
		partialFilterExpression: { status: "pending" },
	},
);

collaboratorSchema.plugin(tenantScopePlugin);
export const CollaboratorModel = mongoose.model(
	"Collaborator",
	collaboratorSchema,
);

export interface StoredCollaborator {
	readonly _id: Types.ObjectId;
	readonly projectId: Types.ObjectId;
	readonly inviteeUserId?: string | null;
	readonly inviteeEmail?: string | null;
	readonly inviteTokenHash?: string | null;
	readonly expiresAt?: Date | null;
	readonly status: CollaboratorStatus;
	readonly invitedBy: string;
	readonly acceptedAt?: Date | null;
	readonly createdAt: Date;
}

/** Whether the row takes a member seat (see `seatHoldersFilter`). */
export function holdsSeat(row: StoredCollaborator, now: Date): boolean {
	if (row.status === "accepted") return true;
	return row.expiresAt instanceof Date && row.expiresAt > now;
}

/**
 * Rows that take a member seat: accepted members and invitations that can
 * still be accepted. Expired invitations free their seat.
 */
export function seatHoldersFilter(
	projectId: Types.ObjectId,
	now: Date,
): Record<string, unknown> {
	return {
		projectId,
		$or: [
			{ status: "accepted" },
			{ status: "pending", expiresAt: { $gt: now } },
		],
	};
}

/**
 * Accepted collaborators per project, for `memberCount` of project views;
 * served by the `(projectId, status)` index.
 */
export function acceptedCountsPipeline(
	projectIds: readonly Types.ObjectId[],
): PipelineStage[] {
	return [
		{ $match: { projectId: { $in: [...projectIds] }, status: "accepted" } },
		{ $group: { _id: "$projectId", count: { $sum: 1 } } },
	];
}
