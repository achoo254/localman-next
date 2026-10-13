import mongoose, { type ClientSession, Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * A member the owner removed from a project. The magic link refuses this
 * account (`REMOVED_BY_OWNER`), so a removal holds even while the link it
 * came through still works; only accepting a new invitation from the
 * owner clears the mark. Members who leave on their own get none. Marks
 * take no seat and are never listed; they go with the project.
 */
const memberRemovalSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true },
		userSub: { type: String, required: true },
		/** `sub` of the owner who removed the member. */
		removedBy: { type: String, required: true },
		removedAt: { type: Date, required: true },
	},
	{ collection: "member_removals", versionKey: false },
);
memberRemovalSchema.index({ projectId: 1, userSub: 1 }, { unique: true });

memberRemovalSchema.plugin(tenantScopePlugin);
export const MemberRemovalModel = mongoose.model(
	"MemberRemoval",
	memberRemovalSchema,
);

/** Whether the owner removed `sub` from the project. */
export async function wasRemovedByOwner(
	projectId: Types.ObjectId,
	sub: string,
	session: ClientSession | null = null,
): Promise<boolean> {
	const mark = await MemberRemovalModel.exists({
		projectId,
		userSub: sub,
	}).session(session);
	return mark !== null;
}
