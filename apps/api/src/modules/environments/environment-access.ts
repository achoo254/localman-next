import { OperationError } from "@localman/operations";
import {
	type ElementRole,
	type EnvironmentAction,
	elementRoleAllows,
} from "@localman/shared/access";
import { ENVIRONMENTS_PER_WORKSPACE_MAX } from "@localman/shared/api-client";
import type { ClientSession, Types } from "mongoose";
import { elementNotFound, requireElement } from "../access/access-policy.js";
import {
	type ElementAdapter,
	type ElementRecord,
	registerElementAdapter,
} from "../access/element-adapters.js";
import { toObjectId } from "../collections/collection-ids.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { ActiveEnvironmentModel } from "./active-environment-model.js";
import { EnvironmentModel } from "./environment-model.js";

export const ENVIRONMENT_ACCESS_NOTE =
	"404 NOT_FOUND when the environment does not exist or the caller holds no role on it (workspace role or share); 403 FORBIDDEN when their role does not allow it.";

/** An environment with the caller's role on it. */
export interface EnvironmentAccess {
	readonly element: ElementRecord;
	readonly environmentId: Types.ObjectId;
	readonly role: ElementRole;
}

/**
 * The environment if `sub` may perform `action` on it: 404 when it does
 * not exist or the caller holds no role on it, 403 when their role lacks
 * the action (a Viewer editing shared values).
 */
export async function requireEnvironment(
	sub: string,
	id: string,
	action: EnvironmentAction,
): Promise<EnvironmentAccess> {
	const { element, role } = await requireElement(
		sub,
		"environment",
		id,
		"view",
	);
	const environmentId = toObjectId(element.id);
	if (!environmentId) throw elementNotFound();
	if (!elementRoleAllows("environment", role, action)) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return { element, environmentId, role };
}

/** 409 `ENVIRONMENT_LIMIT_REACHED` when the workspace holds the most it may. */
export async function assertEnvironmentRoom(
	workspaceId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	const count = await EnvironmentModel.countDocuments({ workspaceId }).session(
		session,
	);
	if (count >= ENVIRONMENTS_PER_WORKSPACE_MAX) {
		throw new OperationError(
			409,
			"ENVIRONMENT_LIMIT_REACHED",
			`A workspace holds at most ${ENVIRONMENTS_PER_WORKSPACE_MAX} environments`,
			{ max: ENVIRONMENTS_PER_WORKSPACE_MAX },
		);
	}
}

async function moveEnvironment(
	environmentId: Types.ObjectId,
	workspaceId: Types.ObjectId,
	session: ClientSession,
): Promise<void> {
	await assertEnvironmentRoom(workspaceId, session);
	const result = await EnvironmentModel.updateOne(
		{ _id: environmentId },
		{ $set: { workspaceId } },
		{ session },
	);
	if (result.matchedCount === 0) throw elementNotFound();
	// It is nobody's active environment in its old workspace any more.
	await ActiveEnvironmentModel.deleteMany({ environmentId }, { session });
}

/**
 * Environments as the access layer sees them. A move rewrites the
 * environment's workspace; without a caller's session it runs under the
 * target workspace's lock, so it cannot land in a workspace being deleted.
 */
export const environmentAdapter: ElementAdapter = {
	async load(id) {
		const _id = toObjectId(id);
		if (!_id) return null;
		const doc = await EnvironmentModel.findById(_id, {
			name: 1,
			workspaceId: 1,
		}).lean<{
			_id: Types.ObjectId;
			name: string;
			workspaceId: Types.ObjectId;
		}>();
		if (!doc) return null;
		return {
			type: "environment",
			id: doc._id.toHexString(),
			name: doc.name,
			workspaceId: doc.workspaceId,
		};
	},
	async moveTo(id, workspaceId, session) {
		const _id = toObjectId(id);
		if (!_id) throw new Error(`Invalid environment id: ${id}`);
		if (session) return moveEnvironment(_id, workspaceId, session);
		await inWorkspaceTransaction(workspaceId, (own) =>
			moveEnvironment(_id, workspaceId, own),
		);
	},
};

/** Plugs environments into the access layer (sharing, moving, requests). */
export function registerEnvironmentAdapter(): void {
	registerElementAdapter("environment", environmentAdapter);
}
