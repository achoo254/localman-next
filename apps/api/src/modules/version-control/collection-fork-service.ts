import { OperationError } from "@localman/operations";
import type {
	CollectionDetail,
	ForkListItem,
	ForkStatus,
} from "@localman/shared/api-client";
import type { Types } from "mongoose";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireCollection } from "../collections/collection-access.js";
import { withNewIds } from "../collections/collection-duplicate-service.js";
import { insertCollection } from "../collections/collection-insert.js";
import { loadCollectionDetail } from "../collections/collection-store.js";
import { inWorkspaceTransaction } from "../workspaces/workspace-lock.js";
import { saveBase } from "./collection-base.js";
import {
	type EnvironmentForkPlan,
	type EnvironmentForkWrite,
	planEnvironmentFork,
	prepareEnvironmentFork,
} from "./environment-fork-service.js";
import { requireForkPlan, requireForkTarget } from "./fork-access.js";
import { renameState } from "./fork-id-space.js";
import { forkStatusOf, forksOf } from "./fork-listing.js";
import { ForkModel } from "./fork-model.js";

/**
 * Forks a collection (Pro): a copy with new node ids in a workspace where
 * the caller adds elements, linked to its source with the pairs of ids and
 * the copied content as the base. A Viewer of the source may fork it into
 * their personal workspace only (403 `FORK_TARGET_NOT_ALLOWED`).
 * `environmentIds` are forked along with it under the same label: every
 * one is checked and its fork slot taken first, then all of it is written
 * in one transaction, so a failure (say the target's environment limit)
 * leaves nothing behind.
 */
export async function forkCollection(
	sub: string,
	id: string,
	input: { label: string; workspaceId: string; environmentIds?: string[] },
): Promise<CollectionDetail> {
	const access = await requireCollection(sub, id, "fork");
	await requireForkPlan(sub);
	await takeOperationSlot("fork", sub, access.element.id);
	const workspace = await requireForkTarget(
		sub,
		access.role,
		input.workspaceId,
	);
	const environments = await planEnvironmentForks(
		sub,
		access.element.workspaceId,
		input,
	);
	const environmentWrites: EnvironmentForkWrite[] = [];
	for (const environment of environments) {
		environmentWrites.push(
			await prepareEnvironmentFork(sub, environment, input.label),
		);
	}
	const source = await loadCollectionDetail(
		access.collectionId,
		access.role,
		sub,
	);
	const { nodes, ids } = withNewIds(source.nodes);
	const { name, description, auth, scripts, variables, tags, status } = source;
	const root = { name, description, auth, scripts, variables, tags, status };
	const pairs = [...ids].map(([s, f]) => ({ s, f }));
	const forkId = await inWorkspaceTransaction(
		workspace._id,
		async (session) => {
			const created = await insertCollection(
				{ workspaceId: workspace._id, root, nodes, sub },
				session,
			);
			const [link] = await ForkModel.create(
				[
					{
						kind: "collection",
						sourceId: access.collectionId,
						forkId: created,
						label: input.label,
						createdBy: sub,
						pairs,
						base: root,
					},
				],
				{ session },
			);
			const toSource = new Map(pairs.map((pair) => [pair.f, pair.s]));
			const base = renameState(
				{
					root,
					nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
				},
				(nodeId) => toSource.get(nodeId) ?? nodeId,
			);
			if (link) await saveBase(link._id, base, pairs, session);
			for (const write of environmentWrites) await write(session);
			return created;
		},
	);
	return loadCollectionDetail(forkId, "editor", sub);
}

/**
 * The environments to fork along with a collection: each one in the
 * collection's workspace (400 `FORK_ENVIRONMENT_OUTSIDE_WORKSPACE`), the
 * caller may fork it into the target, and its fork slot is taken.
 */
async function planEnvironmentForks(
	sub: string,
	sourceWorkspaceId: Types.ObjectId,
	input: { workspaceId: string; environmentIds?: string[] },
): Promise<EnvironmentForkPlan[]> {
	const plans: EnvironmentForkPlan[] = [];
	for (const environmentId of input.environmentIds ?? []) {
		const plan = await planEnvironmentFork(
			sub,
			environmentId,
			input.workspaceId,
		);
		if (!plan.access.element.workspaceId.equals(sourceWorkspaceId)) {
			throw new OperationError(
				400,
				"FORK_ENVIRONMENT_OUTSIDE_WORKSPACE",
				"Only environments of the collection's workspace come along with its fork",
			);
		}
		plans.push(plan);
	}
	for (const plan of plans) {
		await takeOperationSlot("fork", sub, plan.access.element.id);
	}
	return plans;
}

/** Whether the collection is a fork (and of what), and how many forks it has. */
export async function collectionForkStatus(
	sub: string,
	id: string,
): Promise<ForkStatus> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return forkStatusOf(sub, "collection", collectionId);
}

/** The forks of a collection, newest first; `canOpen` per fork. */
export async function listCollectionForks(
	sub: string,
	id: string,
): Promise<ForkListItem[]> {
	const { collectionId } = await requireCollection(sub, id, "view");
	return forksOf(sub, "collection", collectionId);
}
