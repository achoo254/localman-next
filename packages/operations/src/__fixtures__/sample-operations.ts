import { z } from "zod";
import { defineOperation } from "../define-operation.js";

export const getResource = defineOperation({
	id: "mock.getResource",
	method: "GET",
	path: "/projects/:projectId/resources/:resourceId",
	summary: "Get one mock resource",
	description: "Returns a resource of a mock project.",
	input: z.object({
		projectId: z.string().min(1),
		resourceId: z.string().min(1),
		expand: z.enum(["schema", "none"]).optional(),
	}),
	output: z.object({ id: z.string(), projectId: z.string(), name: z.string() }),
	scopes: ["mock:read"],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: (_ctx, input) => ({
		id: input.resourceId,
		projectId: input.projectId,
		name: "users",
	}),
});

export const createResource = defineOperation({
	id: "mock.createResource",
	method: "POST",
	path: "/projects/:projectId/resources",
	summary: "Create a mock resource",
	input: z.object({
		projectId: z.string().min(1),
		name: z.string().min(1).max(64),
		count: z.number().int().min(0).max(100).default(10),
	}),
	output: z.object({ id: z.string(), name: z.string(), count: z.number() }),
	scopes: ["mock:write"],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: (_ctx, input) => ({
		id: "res_1",
		name: input.name,
		count: input.count,
	}),
});

export const deleteProject = defineOperation({
	id: "client.deleteProject",
	method: "DELETE",
	path: "/projects/:projectId",
	summary: "Delete a project",
	input: z.object({ projectId: z.string().min(1) }),
	output: z.object({ deleted: z.boolean(), dryRun: z.boolean() }),
	scopes: ["projects:write"],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: (ctx) => ({ deleted: !ctx.dryRun, dryRun: ctx.dryRun }),
});

export const downloadExtension = defineOperation({
	id: "client.downloadExtension",
	method: "GET",
	path: "/extension/download",
	input: z.object({}),
	output: z.object({ url: z.string() }),
	scopes: [],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: { exempt: "Browser extension utility; useless to an agent" },
	handler: () => ({ url: "https://example.test/extension.zip" }),
});

export const sampleOperations = [
	getResource,
	createResource,
	deleteProject,
	downloadExtension,
];
