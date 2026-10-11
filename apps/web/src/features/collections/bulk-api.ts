/**
 * Deleting many at once and the dry runs before a destructive action: what
 * would go, and `irreversible` (the change is too large for the changelog,
 * so it cannot be undone and blocks restoring older changes). A response
 * without the field reads as reversible.
 */
import { apiRequest, withDryRun } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectRecord,
} from "../../lib/json-guards";
import { collectionPath } from "./collections-api";

export interface DeletionPreview {
	folders: number;
	requests: number;
	examples: number;
	irreversible: boolean;
}

const count = (data: JsonRecord, key: string): number => {
	const value = data[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
};
const irreversible = (data: JsonRecord): boolean => data.irreversible === true;

function deletionOf(value: unknown): DeletionPreview {
	const data = expectRecord(value, "deletion");
	return {
		folders: count(data, "folders"),
		requests: count(data, "requests"),
		examples: count(data, "examples"),
		irreversible: irreversible(data),
	};
}

const nodesPath = (collectionId: string) =>
	`${collectionPath(collectionId)}/nodes`;

export async function previewNodeDelete(
	collectionId: string,
	nodeId: string,
): Promise<DeletionPreview> {
	const path = `${nodesPath(collectionId)}/${encodeURIComponent(nodeId)}`;
	return deletionOf(
		await apiRequest(withDryRun(path, true), { method: "DELETE" }),
	);
}

/** `dryRun` counts what would go; the real call deletes all or nothing. */
export async function bulkDeleteNodes(
	collectionId: string,
	nodeIds: readonly string[],
	dryRun = false,
): Promise<DeletionPreview> {
	return deletionOf(
		await apiRequest(
			withDryRun(`${nodesPath(collectionId)}/bulk-delete`, dryRun),
			{
				method: "POST",
				body: { nodeIds },
			},
		),
	);
}

/** Requests across the collections (to ask for the typed word). */
export async function bulkTrashCollections(
	workspaceId: string,
	collectionIds: readonly string[],
	options: { dryRun?: boolean; confirm?: string } = {},
): Promise<{ requests: number }> {
	const path = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/collections/bulk-trash`;
	const data = expectRecord(
		await apiRequest(withDryRun(path, options.dryRun === true), {
			method: "POST",
			body: options.confirm
				? { collectionIds, confirm: options.confirm }
				: { collectionIds },
		}),
		"bulk trash",
	);
	const requests = expectArray(data, "collections").reduce<number>(
		(sum, item) => sum + count(expectRecord(item, "trashed"), "requests"),
		0,
	);
	return { requests };
}

/** Whether restoring to a change could not be undone afterwards. */
export async function previewRestore(
	collectionId: string,
	revisionId: string,
): Promise<{ irreversible: boolean }> {
	const path = `${collectionPath(collectionId)}/changelog/${encodeURIComponent(revisionId)}/restore`;
	return {
		irreversible: irreversible(
			expectRecord(
				await apiRequest(withDryRun(path, true), { method: "POST" }),
				"restore preview",
			),
		),
	};
}
