import { apiRequest } from "../../lib/api-client";
import {
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
} from "../../lib/json-guards";
import {
	type DataChange,
	type Resource,
	type ResourceInput,
	parseChanges,
	parseResource,
} from "./resource-model";

export const resourcesPath = (projectId: string): string =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/resources`;
export const resourcePath = (projectId: string, resourceId: string): string =>
	`${resourcesPath(projectId)}/${encodeURIComponent(resourceId)}`;
/** Destructive routes answer a preview instead of writing with `?dryRun=true`. */
export const withDryRun = (path: string, dryRun: boolean): string =>
	dryRun ? `${path}?dryRun=true` : path;

/** The project's resources in tree order (parents before children). */
export async function fetchResources(projectId: string): Promise<Resource[]> {
	const data = expectRecord(
		await apiRequest(resourcesPath(projectId)),
		"resource list",
	);
	return expectArray(data, "items").map(parseResource);
}

export async function createResource(
	projectId: string,
	input: ResourceInput,
): Promise<Resource> {
	return parseResource(
		await apiRequest(resourcesPath(projectId), { method: "POST", body: input }),
	);
}

export async function updateResource(
	projectId: string,
	resourceId: string,
	input: ResourceInput,
): Promise<Resource> {
	const { parentId: _parentId, ...body } = input;
	return parseResource(
		await apiRequest(resourcePath(projectId, resourceId), {
			method: "PUT",
			body,
		}),
	);
}

/** Nests a resource under `parentId` (null = root); resets moved data. */
export async function moveResource(
	projectId: string,
	resourceId: string,
	parentId: string | null,
	dryRun: boolean,
): Promise<DataChange[]> {
	const path = `${resourcePath(projectId, resourceId)}/parent`;
	return parseChanges(
		await apiRequest(withDryRun(path, dryRun), {
			method: "PUT",
			body: { parentId },
		}),
	);
}

export interface RemovedResource {
	resourceId: string;
	name: string;
	count: number;
}

/** Deletes a resource with its subtree; the dry run only lists them. */
export async function deleteResource(
	projectId: string,
	resourceId: string,
	dryRun: boolean,
): Promise<RemovedResource[]> {
	const data = expectRecord(
		await apiRequest(withDryRun(resourcePath(projectId, resourceId), dryRun), {
			method: "DELETE",
		}),
		"delete result",
	);
	return expectArray(data, "removed").map((item) => {
		const removed = expectRecord(item, "removed resource");
		return {
			resourceId: expectString(removed, "resourceId"),
			name: expectString(removed, "name"),
			count: expectNumber(removed, "count"),
		};
	});
}
