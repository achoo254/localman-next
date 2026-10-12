import { defineOperation } from "@localman/operations";
import {
	localValuesPatchSchema,
	variableListSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { ENVIRONMENT_ACCESS_NOTE } from "./environment-access.js";
import { deleteEnvironment } from "./environment-delete-service.js";
import {
	ENVIRONMENT_PATH,
	LOCAL_VALUES_BODY_LIMIT,
	VARIABLES_BODY_LIMIT,
	environmentIdSchema,
	workspaceIdSchema,
} from "./environment-inputs.js";
import {
	duplicateEnvironment,
	setEnvironmentVariables,
} from "./environment-service.js";
import { environmentDetailView, localValueView } from "./environment-view.js";
import { patchEnvironmentLocalValues } from "./scope-local-service.js";

export const setEnvironmentVariablesOperation = defineOperation({
	id: "client.setEnvironmentVariables",
	method: "PUT",
	path: `${ENVIRONMENT_PATH}/variables`,
	summary: "Replace an environment's variables and shared values",
	description: `Editors send every variable in order: name, type (\`secret\` is encrypted at rest), enabled, description and \`sharedValue\` (\`null\` leaves it unshared). Keep a variable's \`id\` to keep it; names must be unique. Viewers set local values with set_environment_local_values instead. 503 SECRET_STORAGE_UNAVAILABLE when a secret value cannot be encrypted. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({
		environmentId: environmentIdSchema,
		variables: variableListSchema,
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: VARIABLES_BODY_LIMIT,
	handler: async (ctx, input) =>
		setEnvironmentVariables(
			requireSubject(ctx),
			input.environmentId,
			input.variables,
		),
});

export const setEnvironmentLocalValuesOperation = defineOperation({
	id: "client.setEnvironmentLocalValues",
	method: "PATCH",
	path: `${ENVIRONMENT_PATH}/local-values`,
	summary: "Set or reset your local values in an environment",
	description: `Any role. Local values are the caller's own and never sync to anyone else. \`value: null\` resets a variable to its shared value; names not listed keep theirs. 409 LOCAL_VALUES_LIMIT past the cap. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({
		environmentId: environmentIdSchema,
		values: localValuesPatchSchema,
	}),
	output: z.object({ localValues: z.array(localValueView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: LOCAL_VALUES_BODY_LIMIT,
	handler: async (ctx, input) => ({
		localValues: await patchEnvironmentLocalValues(
			requireSubject(ctx),
			input.environmentId,
			input.values,
		),
	}),
});

export const duplicateEnvironmentOperation = defineOperation({
	id: "client.duplicateEnvironment",
	method: "POST",
	path: `${ENVIRONMENT_PATH}/duplicate`,
	summary: "Duplicate an environment",
	description: `Copies it as "<name> Copy" into \`workspaceId\` (its own by default), where the caller must be Admin or Editor. Viewers may copy it; a secret withheld from them stays unshared in the copy. Local values are not copied. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({
		environmentId: environmentIdSchema,
		workspaceId: workspaceIdSchema.optional(),
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) =>
		duplicateEnvironment(
			requireSubject(ctx),
			input.environmentId,
			input.workspaceId,
		),
});

export const deleteEnvironmentOperation = defineOperation({
	id: "client.deleteEnvironment",
	method: "DELETE",
	path: ENVIRONMENT_PATH,
	summary: "Delete an environment for good",
	description: `Needs the Editor role on it and Admin or Editor in its workspace. Deletes its variables, everyone's local values and its shares; it cannot be restored. dryRun names it and counts its variables. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({ environmentId: environmentIdSchema }),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		environmentId: z.string(),
		name: z.string(),
		variables: z.number().int(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) =>
		deleteEnvironment(requireSubject(ctx), input.environmentId, ctx.dryRun),
});
