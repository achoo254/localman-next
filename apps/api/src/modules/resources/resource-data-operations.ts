import { defineOperation } from "@localman/operations";
import { MAX_GENERATE_COUNT, MAX_RECORDS_PER_RESOURCE } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import {
	generateResourceData,
	readResourceData,
	replaceResourceData,
} from "./resource-data-service.js";
import {
	RESOURCES_PATH,
	RESOURCE_DATA_BODY_LIMIT,
	SIZE_NOTE,
	projectIdParam,
	resourceIdParam,
} from "./resource-operation-params.js";
import { generateAllData, resetAllData } from "./resource-project-data.js";
import { parentKeyIn } from "./resource-store.js";
import { dataChange } from "./resource-view.js";

const changesOutput = z.object({
	dryRun: z.boolean(),
	/** Resources whose record count changes (or is regenerated). */
	changes: z.array(dataChange),
});
const generateCount = z.number().int().min(0).max(MAX_GENERATE_COUNT);
const NESTED_NOTE =
	"A nested resource spreads its records at random over the parent's records and needs parent data first (409 PARENT_HAS_NO_DATA). Children of a resource left empty are reset; children pointing at parent records that no longer exist get a random existing one.";

export const generateResourceDataOperation = defineOperation({
	id: "mock.generateResourceData",
	method: "POST",
	path: `${RESOURCES_PATH}/:resourceId/generate`,
	summary: "Replace a resource's records with generated data",
	description: `Deletes the resource's records and generates \`count\` new ones (0 to ${MAX_GENERATE_COUNT}; 0 resets) from its object template, or its schema when it has none. Ids restart at "1". ${NESTED_NOTE} ${SIZE_NOTE} Call with dryRun to preview.`,
	input: z.object({
		projectId: projectIdParam,
		resourceId: resourceIdParam,
		count: generateCount,
	}),
	output: changesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"update",
			input.projectId,
		);
		const changes = await generateResourceData(
			project,
			input.resourceId,
			input.count,
			ctx.dryRun,
		);
		return { dryRun: ctx.dryRun, changes };
	},
});

export const generateAllResourceData = defineOperation({
	id: "mock.generateAllResourceData",
	method: "POST",
	path: `${RESOURCES_PATH}/generate_all`,
	summary: "Regenerate the records of every resource in a project",
	description: `Replaces the data of every resource, parents first, all or nothing. With \`count\` every resource gets that many records; without it each keeps its current count and an empty one gets 10. A resource under an empty parent stays empty. ${SIZE_NOTE} Call with dryRun to preview.`,
	input: z.object({
		projectId: projectIdParam,
		count: generateCount.optional(),
	}),
	output: changesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"update",
			input.projectId,
		);
		const changes = await generateAllData(project, input.count, ctx.dryRun);
		return { dryRun: ctx.dryRun, changes };
	},
});

export const resetAllResourceData = defineOperation({
	id: "mock.resetAllResourceData",
	method: "POST",
	path: `${RESOURCES_PATH}/reset_all`,
	summary: "Delete the records of every resource in a project",
	description:
		"Empties every resource (ids restart at 1); resources, schemas and endpoints are kept. Call with dryRun to preview.",
	input: z.object({ projectId: projectIdParam }),
	output: changesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"update",
			input.projectId,
		);
		return {
			dryRun: ctx.dryRun,
			changes: await resetAllData(project, ctx.dryRun),
		};
	},
});

export const getResourceData = defineOperation({
	id: "mock.getResourceData",
	method: "GET",
	path: `${RESOURCES_PATH}/:resourceId/data`,
	summary: "Get the raw records of a resource",
	description:
		"Every record as stored, in insertion order: `id`, then the parent id field of a nested resource (`parentKey`), then the data fields. Parent Resource and Child Resource fields are resolved by the mock API, not stored.",
	input: z.object({ projectId: projectIdParam, resourceId: resourceIdParam }),
	output: z.object({
		resourceId: z.string(),
		parentKey: z.string().nullable(),
		count: z.number().int().min(0),
		data: z.array(z.record(z.string(), z.unknown())),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"read",
			input.projectId,
		);
		const { resource, resources, records } = await readResourceData(
			project,
			input.resourceId,
		);
		return {
			resourceId: resource._id.toHexString(),
			parentKey: parentKeyIn(resources, resource),
			count: records.length,
			data: records,
		};
	},
});

export const replaceResourceDataOperation = defineOperation({
	id: "mock.replaceResourceData",
	method: "PUT",
	path: `${RESOURCES_PATH}/:resourceId/data`,
	summary: "Replace the records of a resource with a JSON array",
	description: `\`data\` is an array of up to ${MAX_RECORDS_PER_RESOURCE} JSON objects that becomes the resource's whole data. \`id\` is optional (missing ids get the next numbers) and must be unique, a non-negative integer or a URL-safe string. On a nested resource the parent id field must name an existing parent record; a missing one gets a random parent record. ${NESTED_NOTE} ${SIZE_NOTE} Call with dryRun to validate without writing.`,
	input: z.object({
		projectId: projectIdParam,
		resourceId: resourceIdParam,
		data: z
			.array(z.unknown())
			.max(
				MAX_RECORDS_PER_RESOURCE,
				`A resource holds at most ${MAX_RECORDS_PER_RESOURCE} records`,
			),
	}),
	output: changesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	bodyLimit: RESOURCE_DATA_BODY_LIMIT,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"update",
			input.projectId,
		);
		const changes = await replaceResourceData(
			project,
			input.resourceId,
			input.data,
			ctx.dryRun,
		);
		return { dryRun: ctx.dryRun, changes };
	},
});

export const resourceDataOperations = [
	generateResourceDataOperation,
	generateAllResourceData,
	resetAllResourceData,
	getResourceData,
	replaceResourceDataOperation,
] as const;
