/**
 * Bulk deletion in calls the API accepts: at most `BULK_TRASH_MAX`
 * collections per bulk-trash and `BULK_NODES_MAX` nodes per bulk-delete
 * (the operations' own limits), dry runs chunked the same way. Calls go
 * one after another; a failing one stops the rest.
 */
import { DELETE_CONFIRMATION } from "@localman/shared/api-client";
import { bulkDeleteNodes, bulkTrashCollections } from "./bulk-api";
import type { BulkPlan } from "./bulk-plan";

/** Most nodes one `POST …/nodes/bulk-delete` names. */
export const BULK_NODES_MAX = 200;
/** Most collections one `POST …/collections/bulk-trash` names. */
export const BULK_TRASH_MAX = 100;

export function chunk<T>(items: readonly T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < items.length; i += size)
		out.push(items.slice(i, i + size));
	return out;
}

const collectionIds = (plan: BulkPlan) =>
	plan.collections.map((item) => item.id);

/** Requests the picked collections hold, and whether any deletion is irreversible. */
export async function previewBulk(
	workspaceId: string,
	plan: BulkPlan,
): Promise<{ requests: number; irreversible: boolean }> {
	let requests = 0;
	for (const ids of chunk(collectionIds(plan), BULK_TRASH_MAX)) {
		requests += (await bulkTrashCollections(workspaceId, ids, { dryRun: true }))
			.requests;
	}
	// One irreversible chunk makes the whole deletion so: stop asking then.
	for (const [collectionId, nodeIds] of plan.nodes) {
		for (const ids of chunk(nodeIds, BULK_NODES_MAX)) {
			const preview = await bulkDeleteNodes(collectionId, ids, true);
			if (preview.irreversible) return { requests, irreversible: true };
		}
	}
	return { requests, irreversible: false };
}

/** Thrown when a call fails: how many items went before it. */
export class BulkStopped extends Error {
	constructor(
		readonly done: number,
		readonly reason: unknown,
	) {
		super("Bulk deletion stopped");
		this.name = "BulkStopped";
	}
}

/** Runs the plan; resolves with the number of items deleted. */
export async function runBulk(
	workspaceId: string,
	plan: BulkPlan,
	confirmWord: boolean,
): Promise<number> {
	let done = 0;
	try {
		for (const ids of chunk(collectionIds(plan), BULK_TRASH_MAX)) {
			const options = confirmWord ? { confirm: DELETE_CONFIRMATION } : {};
			await bulkTrashCollections(workspaceId, ids, options);
			done += ids.length;
		}
		for (const [collectionId, nodeIds] of plan.nodes) {
			for (const ids of chunk(nodeIds, BULK_NODES_MAX)) {
				await bulkDeleteNodes(collectionId, ids);
				done += ids.length;
			}
		}
	} catch (error) {
		throw new BulkStopped(done, error);
	}
	return done;
}
