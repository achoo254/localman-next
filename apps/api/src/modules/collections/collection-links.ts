import { OperationError } from "@localman/operations";
import type {
	CollectionEnvironmentLink,
	CollectionMockProjectLink,
	EnvironmentColor,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { elementRoleOf } from "../access/access-policy.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { EnvironmentModel } from "../environments/environment-model.js";
import { can } from "../projects/project-access.js";
import { LIVE_PROJECT, ProjectModel } from "../projects/project-model.js";
import { toObjectId } from "./collection-ids.js";
import { CollectionModel, type StoredCollection } from "./collection-model.js";

/** What a collection's links show to one caller. */
export interface CollectionLinks {
	readonly mockProject: CollectionMockProjectLink | null;
	readonly relatedEnvironment: CollectionEnvironmentLink | null;
}

interface EnvironmentRow {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly color: EnvironmentColor;
	readonly workspaceId: Types.ObjectId;
}

interface ProjectRow {
	readonly _id: Types.ObjectId;
	readonly name: string;
	readonly owner: string;
}

const environmentRecord = (env: EnvironmentRow): ElementRecord => ({
	type: "environment",
	id: env._id.toHexString(),
	name: env.name,
	workspaceId: env.workspaceId,
});

async function findEnvironment(
	id: Types.ObjectId,
): Promise<EnvironmentRow | null> {
	return EnvironmentModel.findById(id, {
		name: 1,
		color: 1,
		workspaceId: 1,
	}).lean<EnvironmentRow>();
}

async function findProject(id: Types.ObjectId): Promise<ProjectRow | null> {
	return ProjectModel.findOne(
		{ _id: id, ...LIVE_PROJECT },
		{ name: 1, owner: 1 },
	).lean<ProjectRow>();
}

/**
 * The environment `id` when it lies in `workspaceId` and `sub` may view
 * it; 400 `INVALID_ENVIRONMENT_LINK` otherwise (a missing environment and
 * one the caller cannot see answer alike).
 */
export async function requireLinkableEnvironment(
	sub: string,
	workspaceId: Types.ObjectId,
	id: string,
): Promise<Types.ObjectId> {
	const _id = toObjectId(id);
	const env = _id ? await findEnvironment(_id) : null;
	const sameWorkspace = env?.workspaceId.equals(workspaceId) === true;
	const readable =
		env !== null &&
		sameWorkspace &&
		(await elementRoleOf(sub, environmentRecord(env), { claim: false })) !==
			null;
	if (!env || !readable) {
		throw new OperationError(
			400,
			"INVALID_ENVIRONMENT_LINK",
			"Link an environment of the collection's workspace that you can open",
		);
	}
	return env._id;
}

/**
 * The mock project `id` when `sub` may read it; 400 `INVALID_MOCK_PROJECT`
 * otherwise (missing, being deleted or someone else's).
 */
export async function requireReadableProject(
	sub: string,
	id: string,
): Promise<Types.ObjectId> {
	const _id = toObjectId(id);
	const project = _id ? await findProject(_id) : null;
	if (!project || !(await can({ sub }, "read", project))) {
		throw new OperationError(
			400,
			"INVALID_MOCK_PROJECT",
			"Link a mock project that you can open",
		);
	}
	return project._id;
}

async function mockProjectFor(
	sub: string,
	id: Types.ObjectId | null | undefined,
): Promise<CollectionMockProjectLink | null> {
	const project = id ? await findProject(id) : null;
	if (!project || !(await can({ sub }, "read", project))) return null;
	return { id: project._id.toHexString(), name: project.name };
}

/**
 * The related environment: the one an Editor linked (their choice wins,
 * `null` included), else the one shared together with the collection.
 * Nothing when it is gone, in another workspace (the collection moved) or
 * not readable by the caller.
 */
async function environmentFor(
	sub: string,
	root: StoredCollection,
): Promise<CollectionEnvironmentLink | null> {
	const chosen = root.linkedEnvironmentId !== undefined;
	const id = chosen ? root.linkedEnvironmentId : root.sharedEnvironmentId;
	const env = id ? await findEnvironment(id) : null;
	if (!env || !env.workspaceId.equals(root.workspaceId)) return null;
	const role = await elementRoleOf(sub, environmentRecord(env), {
		claim: false,
	});
	if (role === null) return null;
	return {
		id: env._id.toHexString(),
		name: env.name,
		color: env.color,
		source: chosen ? "linked" : "shared",
	};
}

/** The links of `root` as `sub` may see them. */
export async function linksFor(
	sub: string,
	root: StoredCollection,
): Promise<CollectionLinks> {
	const [mockProject, relatedEnvironment] = await Promise.all([
		mockProjectFor(sub, root.mockProjectId),
		environmentFor(sub, root),
	]);
	return { mockProject, relatedEnvironment };
}

/**
 * Remembers the environment shared together with a collection, when both
 * sit in the same workspace: it becomes the related environment until an
 * Editor links one. Runs after the share is granted.
 */
export async function rememberSharedEnvironment(
	collection: ElementRecord,
	environment: ElementRecord,
): Promise<void> {
	if (collection.type !== "collection" || environment.type !== "environment") {
		return;
	}
	if (!collection.workspaceId.equals(environment.workspaceId)) return;
	const collectionId = toObjectId(collection.id);
	const environmentId = toObjectId(environment.id);
	if (!collectionId || !environmentId) return;
	await CollectionModel.updateOne(
		{ _id: collectionId },
		{ $set: { sharedEnvironmentId: environmentId } },
	);
}
