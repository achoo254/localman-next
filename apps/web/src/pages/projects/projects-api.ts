import { ApiError, apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

export interface ProjectOwner {
	sub: string;
	username: string | null;
	name: string | null;
	picture: string | null;
}

export interface Project {
	id: string;
	name: string;
	prefix: string;
	secret: string;
	mockBaseUrl: string;
	role: "owner" | "collaborator";
	owner: ProjectOwner;
	createdAt: string;
}

export interface ProjectInput {
	name: string;
	prefix: string;
}

/** What deleting a project would also remove, e.g. `{kind:"resources",count:3}`. */
export interface DeleteDependent {
	kind: string;
	count: number;
}

const PROJECTS = "/api/v1/projects";
const projectPath = (id: string) => `${PROJECTS}/${encodeURIComponent(id)}`;

export function parseProject(value: unknown): Project {
	const data = expectRecord(value, "project");
	const role = expectString(data, "role");
	if (role !== "owner" && role !== "collaborator") {
		throw new InvalidResponseError(`role "${role}"`);
	}
	const owner = expectRecord(data.owner, "owner");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		prefix: optionalString(data, "prefix") ?? "",
		secret: expectString(data, "secret"),
		mockBaseUrl: expectString(data, "mockBaseUrl"),
		role,
		owner: {
			sub: expectString(owner, "sub"),
			username: optionalString(owner, "username"),
			name: optionalString(owner, "name"),
			picture: optionalString(owner, "picture"),
		},
		createdAt: expectString(data, "createdAt"),
	};
}

export async function fetchProjects(): Promise<Project[]> {
	const data = expectRecord(await apiRequest(PROJECTS), "project list");
	return expectArray(data, "items").map(parseProject);
}

export async function createProject(input: ProjectInput): Promise<Project> {
	return parseProject(
		await apiRequest(PROJECTS, { method: "POST", body: input }),
	);
}

export async function updateProject(
	id: string,
	input: ProjectInput,
): Promise<Project> {
	return parseProject(
		await apiRequest(projectPath(id), { method: "PUT", body: input }),
	);
}

export async function cloneProject(id: string): Promise<Project> {
	return parseProject(
		await apiRequest(`${projectPath(id)}/clone`, { method: "POST" }),
	);
}

/** Dry run: what a delete would remove, without deleting anything. */
export async function previewDeleteProject(
	id: string,
): Promise<DeleteDependent[]> {
	const data = expectRecord(
		await apiRequest(`${projectPath(id)}?dryRun=true`, { method: "DELETE" }),
		"delete preview",
	);
	const dependents = Array.isArray(data.dependents) ? data.dependents : [];
	return dependents.map((item) => {
		const dependent = expectRecord(item, "dependent");
		return {
			kind: expectString(dependent, "kind"),
			count: expectNumber(dependent, "count"),
		};
	});
}

export async function deleteProject(id: string): Promise<void> {
	await apiRequest(projectPath(id), { method: "DELETE" });
}

export function isPlanLimitError(error: unknown): boolean {
	return error instanceof ApiError && error.code === "PLAN_LIMIT_REACHED";
}
