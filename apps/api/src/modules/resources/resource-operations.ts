import { defineOperation } from "@localman/operations";
import { resourceCreateSchema, resourceUpdateSchema } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
// Registers resources as project dependents (cascade delete, clone).
import "./resource-dependent.js";
import {
	ACCESS_NOTE,
	PLAN_NOTE,
	RESOURCES_PATH,
	projectIdParam,
	resourceIdParam,
} from "./resource-operation-params.js";
import { createResource, updateResource } from "./resource-service.js";
import { findResource, loadResources } from "./resource-store.js";
import {
	resourceTreeItem,
	resourceView,
	toResourceTree,
	toResourceView,
} from "./resource-view.js";

const PARENT_KEY_NOTE =
	"`parentKey` (nested resources only) names the parent id field of the records: a JavaScript identifier of at most 64 characters, not `id` nor a field of the resource (400 VALIDATION_ERROR at parentKey otherwise); by default it is built from the parent's name (people → personId) and follows a rename of the parent.";

export const listResources = defineOperation({
	id: "mock.listResources",
	method: "GET",
	path: RESOURCES_PATH,
	summary: "List the resource tree of a mock project",
	description: `Every resource of the project in tree order (each parent before its children, siblings oldest first) with \`depth\` (0 = root), \`parentId\`, \`parentKey\` (the generated parent id field, e.g. userId), schema, template, endpoints and record \`count\`. ${ACCESS_NOTE}`,
	input: z.object({ projectId: projectIdParam }),
	output: z.object({ items: z.array(resourceTreeItem) }),
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
		return { items: toResourceTree(await loadResources(project._id)) };
	},
});

export const createResourceOperation = defineOperation({
	id: "mock.createResource",
	method: "POST",
	path: RESOURCES_PATH,
	summary: "Create a resource in a mock project",
	description: `Adds a resource (a REST collection such as \`users\`) at the root or under \`parentId\`, which nests its routes as /parents/:id/children. Defaults: schema createdAt (date.past), name (name.fullName), avatar (image.avatar) besides the generated \`id\`; no object template; GET list, GET one, POST, PUT/PATCH and DELETE enabled with response "$mockData". Schema field types: Faker.js (needs fakerMethod from list_faker_methods), String, Number, Boolean, Object, Array, Date, Parent Resource, Child Resource (needs childId). Sibling names must be unique (409 RESOURCE_NAME_TAKEN). ${PARENT_KEY_NOTE} ${PLAN_NOTE}`,
	input: resourceCreateSchema.extend({ projectId: projectIdParam }),
	output: resourceView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"editResources",
			input.projectId,
		);
		const { resource, resources } = await createResource(project, input);
		return toResourceView(resource, resources);
	},
});

export const getResource = defineOperation({
	id: "mock.getResource",
	method: "GET",
	path: `${RESOURCES_PATH}/:resourceId`,
	summary: "Get one resource of a mock project",
	description: `Schema, object template, endpoints and record count of a resource. ${ACCESS_NOTE}`,
	input: z.object({ projectId: projectIdParam, resourceId: resourceIdParam }),
	output: resourceView,
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
		const resources = await loadResources(project._id);
		return toResourceView(findResource(resources, input.resourceId), resources);
	},
});

export const updateResourceOperation = defineOperation({
	id: "mock.updateResource",
	method: "PUT",
	path: `${RESOURCES_PATH}/:resourceId`,
	summary: "Rename a resource or change its schema, template or endpoints",
	description: `Sets the name and, when sent, replaces the schema, the object template (null to use the schema) or the endpoints (missing endpoints are reset to enabled with "$mockData"). Records are kept. To change the parent use move_resource. ${PARENT_KEY_NOTE} ${ACCESS_NOTE}`,
	input: resourceUpdateSchema.extend({
		projectId: projectIdParam,
		resourceId: resourceIdParam,
	}),
	output: resourceView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const project = await requireProject(
			requireSubject(ctx),
			"editResources",
			input.projectId,
		);
		const { resource, resources } = await updateResource(
			project,
			input.resourceId,
			input,
		);
		return toResourceView(resource, resources);
	},
});

export const resourceOperations = [
	listResources,
	createResourceOperation,
	getResource,
	updateResourceOperation,
] as const;
