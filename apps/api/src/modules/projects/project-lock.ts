import { OperationError } from "@localman/operations";
import mongoose, { type ClientSession, Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { LIVE_PROJECT, ProjectModel } from "./project-model.js";

/**
 * One document per project, bumped first by every transaction that
 * changes the project's resources or records. Two such transactions on the
 * same project therefore write the same document: MongoDB aborts one with
 * a transient write conflict and `withTransaction` retries it on the new
 * state. Without it, moves of two resources under each other could both
 * pass the cycle check (they write different documents) and commit a
 * cycle.
 */
const resourceTreeLockSchema = new Schema(
	{
		_id: { type: Schema.Types.ObjectId, required: true },
		version: { type: Number, required: true, default: 0 },
	},
	{ collection: "resource_tree_locks", versionKey: false },
);

resourceTreeLockSchema.plugin(tenantScopePlugin);
export const ResourceTreeLockModel = mongoose.model(
	"ResourceTreeLock",
	resourceTreeLockSchema,
);

export interface ProjectTransactionOptions {
	/**
	 * Run even when the project document is gone. Only the cleanup of a
	 * deleted project sets this; every other caller gets 404.
	 */
	readonly allowDeletedProject?: boolean;
}

/**
 * Takes the tree lock of `projectId` inside `session`, then checks that
 * the project still exists. Project deletion removes the project document
 * first and then the resources inside this same lock, so a write that
 * passes this check either commits before that cleanup (which then
 * deletes what it wrote) or conflicts with it and, on retry, gets 404.
 */
export async function lockProject(
	projectId: Types.ObjectId,
	session: ClientSession,
	options: ProjectTransactionOptions = {},
): Promise<void> {
	await ResourceTreeLockModel.updateOne(
		{ _id: projectId },
		{ $inc: { version: 1 } },
		{ upsert: true, session },
	);
	if (options.allowDeletedProject) return;
	const exists = await ProjectModel.exists({
		_id: projectId,
		...LIVE_PROJECT,
	}).session(session);
	if (!exists) throw new OperationError(404, "NOT_FOUND", "Project not found");
}

/**
 * Runs `work` in a transaction that holds the project's tree lock (see
 * `lockProject`). Needs a replica set (single-node in development and
 * tests). `work` may run more than once on transient errors, so it must
 * not have side effects outside the session.
 */
export async function inProjectTransaction<T>(
	projectId: Types.ObjectId,
	work: (session: ClientSession) => Promise<T>,
	options: ProjectTransactionOptions = {},
): Promise<T> {
	return mongoose.connection.transaction(async (session) => {
		await lockProject(projectId, session, options);
		return work(session);
	});
}
