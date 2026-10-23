import type { ClientSession, Types } from "mongoose";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "../projects/project-model.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import { loadResources, toTreeNodes } from "../resources/resource-store.js";
import { orderTree } from "../resources/resource-tree.js";
import {
	type MockNodes,
	type MockSyncResource,
	idVariablesOf,
	mockToCollection,
} from "./mock-to-collection-mapper.js";
import type { MockVariables } from "./sync-environment.js";
import type { SyncNames } from "./sync-names.js";

/** What a mock project gives a synced collection now. */
export interface MockSide {
	readonly project: StoredProject;
	readonly nodes: MockNodes;
	readonly variables: MockVariables;
}

/**
 * The project's resources as the collection stands for them; `null` when
 * the project is gone or being deleted (the link then waits, unused).
 */
export async function loadMockSide(
	projectId: Types.ObjectId,
	names: SyncNames,
	session?: ClientSession,
): Promise<MockSide | null> {
	const project = await ProjectModel.findOne({
		_id: projectId,
		...LIVE_PROJECT,
	})
		.session(session ?? null)
		.lean<StoredProject>();
	if (!project) return null;
	const stored = await loadResources(project._id, session ?? null);
	const byId = new Map(stored.map((r) => [r._id.toHexString(), r]));
	const resources = orderTree(toTreeNodes(stored)).flatMap(
		({ node }): MockSyncResource[] => {
			const resource = byId.get(node.id);
			if (!resource) return [];
			return [
				{
					id: node.id,
					name: resource.name,
					parentId: node.parentId,
					schema: resource.schema,
					endpoints: resource.endpoints,
				},
			];
		},
	);
	return {
		project,
		nodes: mockToCollection(resources, names),
		variables: {
			baseUrl: mockBaseUrlOf(project.secret, project.prefix),
			idVariables: idVariablesOf(resources),
		},
	};
}
