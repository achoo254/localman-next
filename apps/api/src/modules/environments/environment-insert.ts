import type { ClientSession, Types } from "mongoose";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { assertEnvironmentRoom } from "./environment-access.js";
import { EnvironmentModel } from "./environment-model.js";
import type { NewEnvironment } from "./environment-service.js";
import type { StoredVariable } from "./variable-store.js";

/**
 * Inserts under the workspace lock, within its room; returns the new id.
 * `alongside` writes more in the same transaction (a fork's link).
 */
type BuildEnvironment = (id: Types.ObjectId) => Omit<
	NewEnvironment,
	"variables"
> & {
	variables: StoredVariable[];
};
type AlongsideEnvironment = (
	id: Types.ObjectId,
	session: ClientSession,
) => Promise<void>;

/**
 * `insertEnvironment` inside the caller's transaction on that workspace,
 * so several inserts (and whatever else it writes) commit or fail as one.
 */
export async function insertEnvironmentIn(
	session: ClientSession,
	workspaceId: Types.ObjectId,
	sub: string,
	build: BuildEnvironment,
	alongside?: AlongsideEnvironment,
): Promise<Types.ObjectId> {
	await assertEnvironmentRoom(workspaceId, session);
	const doc = new EnvironmentModel({ workspaceId, createdBy: sub });
	const fields = build(doc._id);
	doc.set({ ...fields, color: fields.color ?? "grey", updatedBy: sub });
	await doc.save({ session });
	await alongside?.(doc._id, session);
	return doc._id;
}

export async function insertEnvironment(
	workspaceId: Types.ObjectId,
	sub: string,
	build: BuildEnvironment,
	alongside?: AlongsideEnvironment,
): Promise<Types.ObjectId> {
	return inWorkspaceTransaction(workspaceId, (session: ClientSession) =>
		insertEnvironmentIn(session, workspaceId, sub, build, alongside),
	);
}
