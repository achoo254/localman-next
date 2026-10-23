/** Live Mock Sync of collections with mock projects, parsed. */
import type { ConflictSide, MergePreview } from "@localman/shared/api-client";
import { ApiError, apiRequest } from "../../lib/api-client";
import {
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { collectionPath } from "../collections/collections-api";
import { parseMergePreview } from "../version-control/forks-api";

export interface SyncStatus {
	collectionId: string;
	/** `null` when the project is gone or the caller cannot read it. */
	project: { id: string; name: string } | null;
	environmentId: string | null;
	lastSyncedAt: string;
	syncCount: number;
	/** Clashes waiting for a choice. */
	conflicts: number;
	/** Editor of both the collection and the project. */
	canManage: boolean;
	/** Editor of the collection: chooses for conflicts. */
	canResolve: boolean;
}

/** Names of what the sync writes, `{name}` standing for the resource. */
export interface SyncNames {
	list: string;
	get: string;
	create: string;
	update: string;
	patch: string;
	delete: string;
	removedFolder: string;
	removedItem: string;
	environment: string;
}

export interface SyncedCollectionItem {
	collectionId: string;
	name: string;
}

const syncPath = (collectionId: string): string =>
	`${collectionPath(collectionId)}/mock-sync`;
const projectSyncPath = (projectId: string): string =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/synced-collections`;

function parseStatus(value: unknown): SyncStatus {
	const data = expectRecord(value, "mock sync");
	const project =
		data.project === null ? null : expectRecord(data.project, "sync project");
	return {
		collectionId: expectString(data, "collectionId"),
		project: project
			? { id: expectString(project, "id"), name: expectString(project, "name") }
			: null,
		environmentId: optionalString(data, "environmentId"),
		lastSyncedAt: expectString(data, "lastSyncedAt"),
		syncCount: expectNumber(data, "syncCount"),
		conflicts: expectNumber(data, "conflicts"),
		canManage: expectBoolean(data, "canManage"),
		canResolve: expectBoolean(data, "canResolve"),
	};
}

/** The collection's sync, `null` when it does not follow a mock. */
export async function fetchSyncStatus(
	collectionId: string,
): Promise<SyncStatus | null> {
	try {
		return parseStatus(await apiRequest(syncPath(collectionId)));
	} catch (error) {
		if (error instanceof ApiError && error.code === "NOT_SYNCED") return null;
		throw error;
	}
}

export async function fetchSyncPreview(
	collectionId: string,
): Promise<MergePreview> {
	return parseMergePreview(
		await apiRequest(`${syncPath(collectionId)}/preview`),
	);
}

export async function resolveSync(
	collectionId: string,
	resolutions: Record<string, ConflictSide>,
): Promise<SyncStatus> {
	return parseStatus(
		await apiRequest(`${syncPath(collectionId)}/resolve`, {
			method: "POST",
			body: { resolutions },
		}),
	);
}

export async function stopSync(collectionId: string): Promise<void> {
	await apiRequest(syncPath(collectionId), { method: "DELETE" });
}

export async function createSyncedCollection(
	projectId: string,
	workspaceId: string,
	names: SyncNames,
): Promise<{ collectionId: string; environmentId: string }> {
	const data = expectRecord(
		await apiRequest(projectSyncPath(projectId), {
			method: "POST",
			body: { workspaceId, names },
		}),
		"synced collection",
	);
	return {
		collectionId: expectString(data, "collectionId"),
		environmentId: expectString(data, "environmentId"),
	};
}

export async function fetchProjectSyncedCollections(
	projectId: string,
): Promise<SyncedCollectionItem[]> {
	const data = expectRecord(
		await apiRequest(projectSyncPath(projectId)),
		"synced collections",
	);
	return expectArray(data, "items").map((item) => {
		const row = expectRecord(item, "synced collection");
		return {
			collectionId: expectString(row, "collectionId"),
			name: expectString(row, "name"),
		};
	});
}
