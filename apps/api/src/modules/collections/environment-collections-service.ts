import {
	ENVIRONMENT_COLLECTIONS_MAX,
	type EnvironmentCollectionUse,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { elementRoleOf } from "../access/access-policy.js";
import { requireEnvironment } from "../environments/environment-access.js";
import {
	findWorkspaceById,
	workspaceRoleOf,
} from "../workspaces/workspace-roles.js";
import { CollectionModel, LIVE_COLLECTION } from "./collection-model.js";

interface CandidateRow {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly workspaceId: Types.ObjectId;
	readonly linkedEnvironmentId?: Types.ObjectId | null;
}

/**
 * Live collections whose related environment is `id` (as their detail
 * shows it: the linked one when an Editor chose, else the one shared with
 * them), among those the caller may open; by name, at most
 * `ENVIRONMENT_COLLECTIONS_MAX`. Anyone who may view the environment asks.
 * Members of its workspace open every collection there; others are
 * checked one by one, without claiming email shares.
 */
export async function listEnvironmentCollections(
	sub: string,
	id: string,
): Promise<EnvironmentCollectionUse[]> {
	const { element, environmentId } = await requireEnvironment(sub, id, "view");
	const { workspaceId } = element;
	// A workspace holds at most COLLECTIONS_PER_WORKSPACE_MAX collections.
	const rows = await CollectionModel.find(
		{
			workspaceId,
			...LIVE_COLLECTION,
			$or: [
				{ linkedEnvironmentId: environmentId },
				{
					linkedEnvironmentId: { $exists: false },
					sharedEnvironmentId: environmentId,
				},
			],
		},
		{ name: 1, workspaceId: 1, linkedEnvironmentId: 1 },
	).lean<CandidateRow[]>();
	rows.sort((a, b) =>
		a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
	);
	const workspace = await findWorkspaceById(workspaceId.toHexString());
	const member = workspace
		? (await workspaceRoleOf(sub, workspace)) !== null
		: false;
	const items: EnvironmentCollectionUse[] = [];
	for (const row of rows) {
		if (items.length >= ENVIRONMENT_COLLECTIONS_MAX) break;
		const record = {
			type: "collection" as const,
			id: row._id.toHexString(),
			name: row.name,
			workspaceId: row.workspaceId,
		};
		const readable =
			member || (await elementRoleOf(sub, record, { claim: false })) !== null;
		if (!readable) continue;
		items.push({
			id: record.id,
			name: row.name,
			source: row.linkedEnvironmentId ? "linked" : "shared",
		});
	}
	return items;
}
