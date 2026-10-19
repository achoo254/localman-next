import { defineOperation } from "@localman/operations";
import { ELEMENT_ROLES } from "@localman/shared/access";
import {
	localValuesPatchSchema,
	variableListSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import {
	USER_SCOPE,
	isAgentCall,
	requireSubject,
} from "../../http/require-auth.js";
import {
	localPatchForCaller,
	localValuesForCaller,
	valuesForCaller,
} from "./agent-secret-mask.js";
import {
	AGENT_KEEPS_LOCAL,
	AGENT_KEEPS_SHARED,
	LOCAL_VALUES_BODY_LIMIT,
	VALUES_NOTE,
	VARIABLES_BODY_LIMIT,
	workspaceIdSchema,
} from "./environment-inputs.js";
import { localValueView, variableView } from "./environment-view.js";
import {
	getGlobals,
	patchGlobalsLocalValues,
	setGlobals,
} from "./globals-service.js";
import { globalsSecrets } from "./scope-secret-keys.js";

const GLOBALS_PATH = "/workspaces/:workspaceId/globals";
const MEMBERS_NOTE =
	"Members of the workspace only (404 NOT_FOUND otherwise): Admins and Editors change shared values, Viewers set their own local values.";

const globalsView = z.object({
	workspaceId: z.string(),
	role: z.enum(ELEMENT_ROLES),
	variables: z.array(variableView),
	localValues: z.array(localValueView),
	updatedAt: z.string().nullable(),
});

export const getGlobalsOperation = defineOperation({
	id: "client.getGlobals",
	method: "GET",
	path: GLOBALS_PATH,
	summary: "Get a workspace's global variables and your local values",
	description: `Globals are always in use, with the lowest precedence (global < collection < environment < temporary). ${VALUES_NOTE} ${MEMBERS_NOTE}`,
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: globalsView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		valuesForCaller(
			ctx,
			await getGlobals(requireSubject(ctx), input.workspaceId),
		),
});

export const setGlobalsOperation = defineOperation({
	id: "client.setGlobals",
	method: "PUT",
	path: GLOBALS_PATH,
	summary: "Replace a workspace's global variables and shared values",
	description: `Admins and Editors send every global in order, as for environments (403 FORBIDDEN for a Viewer). 503 SECRET_STORAGE_UNAVAILABLE when a secret value cannot be encrypted. ${AGENT_KEEPS_SHARED} ${MEMBERS_NOTE}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		variables: variableListSchema,
	}),
	output: globalsView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: VARIABLES_BODY_LIMIT,
	handler: async (ctx, input) =>
		valuesForCaller(
			ctx,
			await setGlobals(
				requireSubject(ctx),
				input.workspaceId,
				input.variables,
				isAgentCall(ctx),
			),
		),
});

export const setGlobalsLocalValuesOperation = defineOperation({
	id: "client.setGlobalsLocalValues",
	method: "PATCH",
	path: `${GLOBALS_PATH}/local-values`,
	summary: "Set or reset your local values of the globals",
	description: `\`value: null\` resets a global to its shared value; names not listed keep theirs. 409 LOCAL_VALUES_LIMIT past the cap. ${AGENT_KEEPS_LOCAL} ${MEMBERS_NOTE}`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		values: localValuesPatchSchema,
	}),
	output: z.object({ localValues: z.array(localValueView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: LOCAL_VALUES_BODY_LIMIT,
	handler: async (ctx, input) => {
		const secrets = () => globalsSecrets(input.workspaceId);
		const values = await localPatchForCaller(ctx, input.values, secrets);
		return {
			localValues: await localValuesForCaller(
				ctx,
				await patchGlobalsLocalValues(
					requireSubject(ctx),
					input.workspaceId,
					values,
				),
				secrets,
			),
		};
	},
});

export const globalsOperations = [
	getGlobalsOperation,
	setGlobalsOperation,
	setGlobalsLocalValuesOperation,
] as const;
