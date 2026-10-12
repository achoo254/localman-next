/**
 * The caller's active environment of a workspace and their local values
 * of a collection's variables. Every answer is parsed.
 */
import type {
	ActiveEnvironment,
	LocalValue,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectRecord } from "../../lib/json-guards";
import {
	parseActiveEnvironment,
	parseLocalValues,
} from "./environment-parsers";
import {
	type LocalValueWrite,
	patchLocal,
	workspacePath,
} from "./environments-api";

export async function fetchActiveEnvironment(
	workspaceId: string,
): Promise<ActiveEnvironment> {
	return parseActiveEnvironment(
		await apiRequest(workspacePath(workspaceId, "active-environment")),
	);
}

export async function setActiveEnvironment(
	workspaceId: string,
	environmentId: string | null,
): Promise<ActiveEnvironment> {
	return parseActiveEnvironment(
		await apiRequest(workspacePath(workspaceId, "active-environment"), {
			method: "PUT",
			body: { environmentId },
		}),
	);
}

const collectionLocalPath = (id: string): string =>
	`/api/v1/collections/${encodeURIComponent(id)}/local-values`;

export async function fetchCollectionLocalValues(
	collectionId: string,
): Promise<LocalValue[]> {
	const data = expectRecord(
		await apiRequest(collectionLocalPath(collectionId)),
		"local values",
	);
	return parseLocalValues(data.localValues);
}

export function setCollectionLocalValues(
	collectionId: string,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	return patchLocal(collectionLocalPath(collectionId), values);
}
