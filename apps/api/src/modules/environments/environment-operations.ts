import { defineOperation } from "@localman/operations";
import {
	environmentColorSchema,
	environmentNameSchema,
	variableListSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { valuesForCaller } from "./agent-secret-mask.js";
import {
	ENVIRONMENT_ACCESS_NOTE,
	registerEnvironmentAdapter,
} from "./environment-access.js";
import {
	deleteEnvironmentOperation,
	duplicateEnvironmentOperation,
	setEnvironmentLocalValuesOperation,
	setEnvironmentVariablesOperation,
} from "./environment-change-operations.js";
import {
	ENVIRONMENT_PATH,
	VALUES_NOTE,
	VARIABLES_BODY_LIMIT,
	environmentIdSchema,
	workspaceIdSchema,
} from "./environment-inputs.js";
import { listEnvironments } from "./environment-list-service.js";
import {
	createEnvironment,
	getEnvironment,
	updateEnvironment,
} from "./environment-service.js";
import {
	environmentDetailView,
	environmentSummaryView,
} from "./environment-view.js";

registerEnvironmentAdapter();

export const listEnvironmentsOperation = defineOperation({
	id: "client.listEnvironments",
	method: "GET",
	path: "/workspaces/:workspaceId/environments",
	summary: "List the environments of a workspace",
	description:
		"Environments of the workspace with the caller's role and variable count, by name. Members see every environment; others only those shared with them (404 NOT_FOUND when there are none).",
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: z.object({ items: z.array(environmentSummaryView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listEnvironments(requireSubject(ctx), input.workspaceId),
	}),
});

export const createEnvironmentOperation = defineOperation({
	id: "client.createEnvironment",
	method: "POST",
	path: "/workspaces/:workspaceId/environments",
	summary: "Create an environment in a workspace",
	description:
		"Admins and Editors of the workspace. `variables` are optional definitions with their shared values. 409 ENVIRONMENT_LIMIT_REACHED past the workspace's limit; 503 SECRET_STORAGE_UNAVAILABLE when a secret value is sent and the server cannot encrypt it. 404 NOT_FOUND for a workspace the caller is not in.",
	input: z.object({
		workspaceId: workspaceIdSchema,
		name: environmentNameSchema,
		color: environmentColorSchema.optional(),
		variables: variableListSchema.optional(),
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	bodyLimit: VARIABLES_BODY_LIMIT,
	handler: async (ctx, input) => {
		const { workspaceId, ...rest } = input;
		return valuesForCaller(
			ctx,
			await createEnvironment(requireSubject(ctx), workspaceId, rest),
		);
	},
});

export const getEnvironmentOperation = defineOperation({
	id: "client.getEnvironment",
	method: "GET",
	path: ENVIRONMENT_PATH,
	summary: "Get an environment with its variables and your local values",
	description: `${VALUES_NOTE} ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({ environmentId: environmentIdSchema }),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		valuesForCaller(
			ctx,
			await getEnvironment(requireSubject(ctx), input.environmentId),
		),
});

export const updateEnvironmentOperation = defineOperation({
	id: "client.updateEnvironment",
	method: "PATCH",
	path: ENVIRONMENT_PATH,
	summary: "Rename or recolor an environment",
	description: `Editors. Omitted fields stay. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({
		environmentId: environmentIdSchema,
		name: environmentNameSchema.optional(),
		color: environmentColorSchema.optional(),
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => {
		const { environmentId, ...update } = input;
		return valuesForCaller(
			ctx,
			await updateEnvironment(requireSubject(ctx), environmentId, update),
		);
	},
});

export const environmentOperations = [
	listEnvironmentsOperation,
	createEnvironmentOperation,
	getEnvironmentOperation,
	updateEnvironmentOperation,
	setEnvironmentVariablesOperation,
	setEnvironmentLocalValuesOperation,
	duplicateEnvironmentOperation,
	deleteEnvironmentOperation,
] as const;
