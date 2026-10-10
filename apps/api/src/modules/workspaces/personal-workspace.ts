import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { type StoredWorkspace, WorkspaceModel } from "./workspace-model.js";

export const PERSONAL_WORKSPACE_NAME = "My Workspace";

function findPersonal(ownerSub: string): Promise<StoredWorkspace | null> {
	return WorkspaceModel.findOne({
		ownerId: ownerSub,
		type: "personal",
	}).lean<StoredWorkspace>();
}

/**
 * The user's personal workspace, created on first use. Two requests
 * creating it at once both insert; the unique partial index on `ownerId`
 * keeps one, and the loser reads the winner's.
 */
export async function ensurePersonalWorkspace(
	ownerSub: string,
): Promise<StoredWorkspace> {
	const existing = await findPersonal(ownerSub);
	if (existing) return existing;
	try {
		const created = await WorkspaceModel.create({
			name: PERSONAL_WORKSPACE_NAME,
			type: "personal",
			visibility: "personal",
			ownerId: ownerSub,
		});
		return created.toObject<StoredWorkspace>();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		const winner = await findPersonal(ownerSub);
		if (!winner) throw error;
		return winner;
	}
}
