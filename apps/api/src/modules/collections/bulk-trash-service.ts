import { elementNotFound } from "../access/access-policy.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import {
	type CollectionTrashing,
	type Trashable,
	assertConfirmed,
	collectionToTrash,
	moveToTrash,
	trashingView,
} from "./trash-service.js";

export interface BulkTrashing {
	readonly dryRun: boolean;
	readonly deleted: boolean;
	readonly collections: CollectionTrashing[];
}

/**
 * Moves several collections of one workspace to the trash together:
 * each needs the rights of a single delete, `confirm: "delete"` is needed
 * when any holds requests, and either all go or none (one transaction
 * under the workspace lock). A collection of another workspace answers
 * 404 like a missing one.
 */
export async function trashCollections(
	sub: string,
	workspaceId: string,
	collectionIds: readonly string[],
	confirm: string | undefined,
	dryRun: boolean,
): Promise<BulkTrashing> {
	const { workspace } = await requireWorkspace(
		sub,
		"moveDeleteElements",
		workspaceId,
	);
	const items: Trashable[] = [];
	for (const id of new Set(collectionIds)) {
		// The workspace role was checked once above; each needs Editor on it.
		const item = await collectionToTrash(sub, id);
		if (!item.element.workspaceId.equals(workspace._id))
			throw elementNotFound();
		items.push(item);
	}
	if (!dryRun) {
		assertConfirmed(items, confirm);
		await inWorkspaceTransaction(workspace._id, (session) =>
			moveToTrash(items, sub, session),
		);
	}
	return { dryRun, deleted: !dryRun, collections: items.map(trashingView) };
}
