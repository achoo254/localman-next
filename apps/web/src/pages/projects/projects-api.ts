import { ApiError, apiRequest, withDryRun } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
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
	/** Owner plus accepted collaborators (pending invitations excluded). */
	memberCount: number;
	createdAt: string;
	/** Sizes the list answers with; absent elsewhere and from older APIs. */
	counts?: ProjectCounts;
}

export interface ProjectCounts {
	resources: number;
	records: number;
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

const isCount = (value: unknown): value is number =>
	typeof value === "number" && Number.isInteger(value) && value >= 0;

/** `resourceCount` and `recordCount` when both are there, else nothing. */
function countsOf(data: JsonRecord): { counts?: ProjectCounts } {
	const { resourceCount, recordCount } = data;
	return isCount(resourceCount) && isCount(recordCount)
		? { counts: { resources: resourceCount, records: recordCount } }
		: {};
}

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
		memberCount: expectNumber(data, "memberCount"),
		createdAt: expectString(data, "createdAt"),
		...countsOf(data),
	};
}

export async function fetchProjects(): Promise<Project[]> {
	const data = expectRecord(await apiRequest(PROJECTS), "project list");
	return expectArray(data, "items").map(parseProject);
}

/** One project, or null when it does not exist or the user cannot read it. */
export async function fetchProject(id: string): Promise<Project | null> {
	try {
		return parseProject(await apiRequest(projectPath(id)));
	} catch (error) {
		if (error instanceof ApiError && error.status === 404) return null;
		throw error;
	}
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
		await apiRequest(withDryRun(projectPath(id), true), { method: "DELETE" }),
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

/** `mock.rotateProjectSecret`: `{ dryRun, collaborators, project }`. */
async function requestRotateSecret(id: string, dryRun: boolean) {
	return expectRecord(
		await apiRequest(withDryRun(`${projectPath(id)}/rotate-secret`, dryRun), {
			method: "POST",
			body: {},
		}),
		"secret rotation",
	);
}

/** Dry run: how many collaborators will be told the mock URL changed. */
export async function previewRotateSecret(id: string): Promise<number> {
	return expectNumber(await requestRotateSecret(id, true), "collaborators");
}

/** New secret, so the old mock URL stops working; returns the new project. */
export async function rotateSecret(id: string): Promise<Project> {
	return parseProject((await requestRotateSecret(id, false)).project);
}

export function isPlanLimitError(error: unknown): boolean {
	return error instanceof ApiError && error.code === "PLAN_LIMIT_REACHED";
}
