import { OperationError } from "@localman/operations";
import mongoose, { type ClientSession, Schema, type Types } from "mongoose";
import { WorkspaceModel } from "./workspace-model.js";

/**
 * One document per lock key, bumped first by every transaction that must
 * not interleave with another one of the same key (as `project-lock.ts`
 * does for projects). Two such transactions write the same document, so
 * MongoDB aborts one with a transient write conflict and `withTransaction`
 * retries it on the committed state: two invitations cannot both take the
 * last seat, two creations cannot both pass the team workspace quota.
 */
const workspaceLockSchema = new Schema(
	{
		_id: { type: String, required: true },
		version: { type: Number, required: true, default: 0 },
	},
	{ collection: "workspace_locks", versionKey: false },
);

const WorkspaceLockModel = mongoose.model("WorkspaceLock", workspaceLockSchema);

async function bump(key: string, session: ClientSession): Promise<void> {
	await WorkspaceLockModel.updateOne(
		{ _id: key },
		{ $inc: { version: 1 } },
		{ upsert: true, session },
	);
}

/**
 * Runs `work` in a transaction holding the lock of the workspace, after
 * checking that the workspace still exists (404 otherwise): a write racing
 * the deletion either commits first, and the deletion removes what it
 * wrote, or retries into 404. `work` may run more than once on transient
 * errors, so it must not have side effects outside the session.
 */
export async function inWorkspaceTransaction<T>(
	workspaceId: Types.ObjectId,
	work: (session: ClientSession) => Promise<T>,
): Promise<T> {
	return mongoose.connection.transaction(async (session) => {
		await bump(`workspace:${workspaceId.toHexString()}`, session);
		const exists = await WorkspaceModel.exists({ _id: workspaceId }).session(
			session,
		);
		if (!exists) {
			throw new OperationError(404, "NOT_FOUND", "Workspace not found");
		}
		return work(session);
	});
}

/**
 * Runs `work` in a transaction holding the lock of the user `ownerSub`,
 * for counts of what they own (team workspaces against their plan).
 */
export async function inOwnerTransaction<T>(
	ownerSub: string,
	work: (session: ClientSession) => Promise<T>,
): Promise<T> {
	return mongoose.connection.transaction(async (session) => {
		await bump(`owner:${ownerSub}`, session);
		return work(session);
	});
}
