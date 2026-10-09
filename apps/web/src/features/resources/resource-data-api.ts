import { apiRequest } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	isRecord,
	optionalString,
} from "../../lib/json-guards";
import { type DataChange, parseChanges } from "./resource-model";
import { resourcePath, resourcesPath, withDryRun } from "./resources-api";

export interface ResourceData {
	parentKey: string | null;
	count: number;
	records: JsonRecord[];
}

/**
 * Replaces a resource's records with `count` generated ones (0 resets);
 * the dry run only reports the counts that would change.
 */
export async function generateResourceData(
	projectId: string,
	resourceId: string,
	count: number,
	dryRun = false,
): Promise<DataChange[]> {
	const path = `${resourcePath(projectId, resourceId)}/generate`;
	return parseChanges(
		await apiRequest(withDryRun(path, dryRun), {
			method: "POST",
			body: { count },
		}),
	);
}

/** Regenerates every resource (empty ones get the default count). */
export async function generateAllData(
	projectId: string,
	dryRun: boolean,
): Promise<DataChange[]> {
	return parseChanges(
		await apiRequest(
			withDryRun(`${resourcesPath(projectId)}/generate_all`, dryRun),
			{ method: "POST", body: {} },
		),
	);
}

/** Empties every resource of the project. */
export async function resetAllData(
	projectId: string,
	dryRun: boolean,
): Promise<DataChange[]> {
	return parseChanges(
		await apiRequest(
			withDryRun(`${resourcesPath(projectId)}/reset_all`, dryRun),
			{ method: "POST", body: {} },
		),
	);
}

export async function fetchResourceData(
	projectId: string,
	resourceId: string,
): Promise<ResourceData> {
	const data = expectRecord(
		await apiRequest(`${resourcePath(projectId, resourceId)}/data`),
		"resource data",
	);
	return {
		parentKey: optionalString(data, "parentKey"),
		count: expectNumber(data, "count"),
		records: expectArray(data, "data").filter(isRecord),
	};
}

/** Replaces the whole data of a resource with `records` (or previews it). */
export async function replaceResourceData(
	projectId: string,
	resourceId: string,
	records: readonly JsonRecord[],
	dryRun = false,
): Promise<DataChange[]> {
	const path = `${resourcePath(projectId, resourceId)}/data`;
	return parseChanges(
		await apiRequest(withDryRun(path, dryRun), {
			method: "PUT",
			body: { data: records },
		}),
	);
}
