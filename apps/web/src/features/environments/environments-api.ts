/**
 * Environments, globals, local values and the active environment
 * (`/api/v1/workspaces/:id/environments|globals`, `/api/v1/environments/...`);
 * the active environment and collection local values are in
 * `variable-scopes-api.ts`. Every answer is parsed.
 */
import type {
	EnvironmentColor,
	EnvironmentDetail,
	EnvironmentSummary,
	GlobalsDetail,
	LocalValue,
	VariableType,
} from "@localman/shared/api-client";
import { apiRequest } from "../../lib/api-client";
import { expectArray, expectRecord } from "../../lib/json-guards";
import {
	parseEnvironmentDetail,
	parseEnvironmentSummary,
	parseGlobals,
	parseLocalValues,
} from "./environment-parsers";

export const workspacePath = (workspaceId: string, suffix: string): string =>
	`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/${suffix}`;
export const environmentPath = (id: string): string =>
	`/api/v1/environments/${encodeURIComponent(id)}`;

/** A variable as an Editor sends it; keep `id` to keep the variable. */
export interface VariableWrite {
	id?: string;
	key: string;
	type: VariableType;
	enabled: boolean;
	description: string;
	sharedValue: string | null;
}

/** `value: null` resets a variable to its shared value. */
export type LocalValueWrite = { key: string; value: string | null };

export async function fetchEnvironments(
	workspaceId: string,
): Promise<EnvironmentSummary[]> {
	const data = expectRecord(
		await apiRequest(workspacePath(workspaceId, "environments")),
		"environment list",
	);
	return expectArray(data, "items").map(parseEnvironmentSummary);
}

export async function fetchEnvironment(id: string): Promise<EnvironmentDetail> {
	return parseEnvironmentDetail(await apiRequest(environmentPath(id)));
}

export async function createEnvironment(
	workspaceId: string,
	body: { name: string; color?: EnvironmentColor },
): Promise<EnvironmentDetail> {
	return parseEnvironmentDetail(
		await apiRequest(workspacePath(workspaceId, "environments"), {
			method: "POST",
			body,
		}),
	);
}

export async function updateEnvironment(
	id: string,
	patch: { name?: string; color?: EnvironmentColor },
): Promise<EnvironmentDetail> {
	return parseEnvironmentDetail(
		await apiRequest(environmentPath(id), { method: "PATCH", body: patch }),
	);
}

export async function setEnvironmentVariables(
	id: string,
	variables: VariableWrite[],
): Promise<EnvironmentDetail> {
	return parseEnvironmentDetail(
		await apiRequest(`${environmentPath(id)}/variables`, {
			method: "PUT",
			body: { variables },
		}),
	);
}

export async function patchLocal(
	path: string,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	const data = expectRecord(
		await apiRequest(path, { method: "PATCH", body: { values } }),
		"local values",
	);
	return parseLocalValues(data.localValues);
}

export function setEnvironmentLocalValues(
	id: string,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	return patchLocal(`${environmentPath(id)}/local-values`, values);
}

export async function duplicateEnvironment(
	id: string,
): Promise<EnvironmentDetail> {
	return parseEnvironmentDetail(
		await apiRequest(`${environmentPath(id)}/duplicate`, { method: "POST" }),
	);
}

export interface EnvironmentDeletion {
	deleted: boolean;
	name: string;
	variables: number;
}

/** `dryRun` names it and counts its variables without deleting. */
export async function deleteEnvironment(
	id: string,
	dryRun: boolean,
): Promise<EnvironmentDeletion> {
	const data = expectRecord(
		await apiRequest(`${environmentPath(id)}${dryRun ? "?dryRun=true" : ""}`, {
			method: "DELETE",
		}),
		"environment deletion",
	);
	return {
		deleted: data.deleted === true,
		name: typeof data.name === "string" ? data.name : "",
		variables: typeof data.variables === "number" ? data.variables : 0,
	};
}

export async function fetchGlobals(
	workspaceId: string,
): Promise<GlobalsDetail> {
	return parseGlobals(await apiRequest(workspacePath(workspaceId, "globals")));
}

export async function setGlobals(
	workspaceId: string,
	variables: VariableWrite[],
): Promise<GlobalsDetail> {
	return parseGlobals(
		await apiRequest(workspacePath(workspaceId, "globals"), {
			method: "PUT",
			body: { variables },
		}),
	);
}

export function setGlobalsLocalValues(
	workspaceId: string,
	values: LocalValueWrite[],
): Promise<LocalValue[]> {
	return patchLocal(workspacePath(workspaceId, "globals/local-values"), values);
}
