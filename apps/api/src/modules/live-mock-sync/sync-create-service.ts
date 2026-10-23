import { OperationError } from "@localman/operations";
import {
	COLLECTION_NAME_MAX,
	type CollectionDetail,
	type CollectionRootFields,
	ENVIRONMENT_NAME_MAX,
} from "@localman/shared/api-client";
import { insertCollection } from "../collections/collection-insert.js";
import {
	loadCollectionDetail,
	newNodeId,
} from "../collections/collection-store.js";
import { insertEnvironmentIn } from "../environments/environment-insert.js";
import { requireProject } from "../projects/project-service.js";
import { renameState } from "../version-control/fork-id-space.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { loadMockSide } from "./mock-side.js";
import { initialVariables } from "./sync-environment.js";
import { SyncLinkModel, saveSyncBase } from "./sync-link-model.js";
import { type SyncNames, fillName } from "./sync-names.js";

export interface SyncedCollection {
	readonly collection: CollectionDetail;
	readonly environmentId: string;
}

function rootOf(name: string): CollectionRootFields {
	return {
		name: name.slice(0, COLLECTION_NAME_MAX),
		description: "",
		auth: { type: "none" },
		scripts: { pre: "", post: "" },
		variables: [],
		tags: [],
		status: null,
	};
}

/**
 * Makes a collection that follows the mock project (an Editor of the
 * project who adds elements to the workspace): a folder per resource and a
 * request per enabled endpoint on `{{baseUrl}}`, with an environment
 * holding `baseUrl` and one id variable per resource, linked to it. Both
 * are written with the link in one transaction.
 */
export async function createSyncedCollection(
	sub: string,
	projectId: string,
	workspaceId: string,
	names: SyncNames,
): Promise<SyncedCollection> {
	const project = await requireProject(sub, "editResources", projectId);
	const { workspace } = await requireWorkspace(sub, "addElements", workspaceId);
	const side = await loadMockSide(project._id, names);
	if (!side) throw new OperationError(404, "NOT_FOUND", "Project not found");
	const ids = new Map(Object.keys(side.nodes).map((key) => [key, newNodeId()]));
	const nodes = renameState(
		{ root: rootOf(project.name), nodes: side.nodes },
		(key) => ids.get(key) ?? key,
	);
	const { collectionId, environmentId } = await inWorkspaceTransaction(
		workspace._id,
		async (session) => {
			const environmentId = await insertEnvironmentIn(
				session,
				workspace._id,
				sub,
				() => ({
					name: fillName(names.environment, project.name).slice(
						0,
						ENVIRONMENT_NAME_MAX,
					),
					variables: initialVariables(side.variables),
				}),
			);
			const collectionId = await insertCollection(
				{
					workspaceId: workspace._id,
					root: nodes.root,
					nodes: Object.values(nodes.nodes),
					sub,
					mockProjectId: project._id,
					linkedEnvironmentId: environmentId,
				},
				session,
			);
			const [link] = await SyncLinkModel.create(
				[
					{
						collectionId,
						projectId: project._id,
						workspaceId: workspace._id,
						environmentId,
						createdBy: sub,
						names,
						pairs: [...ids].map(([k, n]) => ({ k, n })),
						baseUrl: side.variables.baseUrl,
						idVariables: [...side.variables.idVariables],
						lastSyncedAt: new Date(),
					},
				],
				{ session },
			);
			if (link) await saveSyncBase(link._id, side.nodes, session);
			return { collectionId, environmentId };
		},
	);
	return {
		collection: await loadCollectionDetail(collectionId, "editor", sub),
		environmentId: environmentId.toHexString(),
	};
}
