import type request from "supertest";
import { expect } from "vitest";
import { as } from "../../../test-support/dashboard-test-app.js";

/** TEST ONLY. API helpers for resource tests. */
export interface ResourceBody {
	id: string;
	name: string;
	parentId: string | null;
	parentKey: string | null;
	count: number;
	schema: {
		name: string;
		type: string;
		fakerMethod?: string;
		childId?: string;
	}[];
	endpoints: {
		method: string;
		path: string;
		enabled: boolean;
		response: unknown;
	}[];
	template: Record<string, unknown> | null;
}

export async function createProject(
	sub: string,
	name = "Demo",
): Promise<string> {
	const res = await as(sub).send("post", "/projects", { name });
	expect(res.status).toBe(201);
	return res.body.id as string;
}

export const resourcesPath = (projectId: string, suffix = ""): string =>
	`/projects/${projectId}/resources${suffix}`;

export async function createResource(
	sub: string,
	projectId: string,
	body: Record<string, unknown>,
): Promise<ResourceBody> {
	const res = await as(sub).send("post", resourcesPath(projectId), body);
	expect(res.status, JSON.stringify(res.body)).toBe(201);
	return res.body as ResourceBody;
}

export function generate(
	sub: string,
	projectId: string,
	resourceId: string,
	count: number,
): request.Test {
	return as(sub).send(
		"post",
		resourcesPath(projectId, `/${resourceId}/generate`),
		{ count },
	);
}

export async function readData(
	sub: string,
	projectId: string,
	resourceId: string,
): Promise<Record<string, unknown>[]> {
	const res = await as(sub).get(
		resourcesPath(projectId, `/${resourceId}/data`),
	);
	expect(res.status).toBe(200);
	return res.body.data as Record<string, unknown>[];
}
