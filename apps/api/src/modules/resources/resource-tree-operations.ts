import { defineOperation } from "@localman/operations";
import { FAKER_METHOD_GROUPS, OBJECT_ID_PATTERN } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import {
	ACCESS_NOTE,
	RESOURCES_PATH,
	projectIdParam,
	resourceIdParam,
} from "./resource-operation-params.js";
import { deleteResource, moveResource } from "./resource-restructure.js";
import { dataChange, resourceView, toResourceView } from "./resource-view.js";

export const deleteResourceOperation = defineOperation({
	id: "mock.deleteResource",
	method: "DELETE",
	path: `${RESOURCES_PATH}/:resourceId`,
	summary: "Delete a resource with its child resources and records",
	description: `Removes the resource, every resource nested under it, all their records and their mock callbacks (deliveries still waiting included). Call with dryRun first to list what would be removed. ${ACCESS_NOTE}`,
	input: z.object({ projectId: projectIdParam, resourceId: resourceIdParam }),
	output: z.object({
		dryRun: z.boolean(),
		removed: z.array(
			z.object({ resourceId: z.string(), name: z.string(), count: z.number() }),
		),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	// Wide blast radius: the MCP tool needs a dry run and its confirm token.
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"editResources",
			input.projectId,
		);
		const removed = await deleteResource(project, input.resourceId, ctx.dryRun);
		return { dryRun: ctx.dryRun, removed };
	},
});

export const moveResourceOperation = defineOperation({
	id: "mock.moveResource",
	method: "PUT",
	path: `${RESOURCES_PATH}/:resourceId/parent`,
	summary: "Nest a resource under another one, or move it to the root",
	description: `Sets the parent (null for the root). The records of the moved resource and of everything under it are reset, since they belonged to the old parent; the generated parent id field follows the new parent. Refuses cycles (409 TREE_CYCLE), a sibling with the same name (409 RESOURCE_NAME_TAKEN) and trees deeper than the limit (409 TREE_TOO_DEEP). Call with dryRun to see which data would be reset. ${ACCESS_NOTE}`,
	input: z.object({
		projectId: projectIdParam,
		resourceId: resourceIdParam,
		parentId: z.string().regex(OBJECT_ID_PATTERN).nullable(),
	}),
	output: z.object({
		dryRun: z.boolean(),
		resource: resourceView,
		changes: z.array(dataChange),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"editResources",
			input.projectId,
		);
		const moved = await moveResource(
			project,
			input.resourceId,
			input.parentId,
			ctx.dryRun,
		);
		return {
			dryRun: ctx.dryRun,
			resource: toResourceView(moved.resource, moved.resources),
			changes: moved.changes,
		};
	},
});

export const listFakerMethods = defineOperation({
	id: "mock.listFakerMethods",
	method: "GET",
	path: "/faker-methods",
	summary: "List the Faker methods usable in resource schemas and templates",
	description:
		'Whitelisted `category.method` ids, grouped by category. Use them as `fakerMethod` of Faker.js schema fields, or as whole-string "$category.method" values in object templates and custom responses.',
	input: z.object({}),
	output: z.object({
		categories: z.array(
			z.object({ category: z.string(), methods: z.array(z.string()) }),
		),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: () => ({
		categories: FAKER_METHOD_GROUPS.map((group) => ({
			category: group.category,
			methods: [...group.ids],
		})),
	}),
});

export const resourceTreeOperations = [
	deleteResourceOperation,
	moveResourceOperation,
	listFakerMethods,
] as const;
