import { defineOperation } from "@localman/operations";
import { localValuesPatchSchema } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import {
	localPatchForCaller,
	localValuesForCaller,
} from "./agent-secret-mask.js";
import {
	AGENT_KEEPS_LOCAL,
	LOCAL_VALUES_BODY_LIMIT,
	environmentIdSchema,
	workspaceIdSchema,
} from "./environment-inputs.js";
import { localValueView } from "./environment-view.js";
import {
	getActiveEnvironment,
	getCollectionLocalValues,
	patchCollectionLocalValues,
	setActiveEnvironment,
} from "./scope-local-service.js";
import { collectionSecrets } from "./scope-secret-keys.js";

const ACTIVE_PATH = "/workspaces/:workspaceId/active-environment";
const COLLECTION_LOCAL_PATH = "/collections/:collectionId/local-values";

const localValuesOutput = z.object({ localValues: z.array(localValueView) });
const activeView = z.object({
	workspaceId: z.string(),
	environmentId: z.string().nullable(),
});
const collectionIdSchema = z.string().min(1).max(64);

export const getActiveEnvironmentOperation = defineOperation({
	id: "client.getActiveEnvironment",
	method: "GET",
	path: ACTIVE_PATH,
	summary: "Get the environment you use in a workspace",
	description:
		"`environmentId: null` when none is picked, or the one picked was deleted, moved to another workspace or is no longer shared with you.",
	input: z.object({ workspaceId: workspaceIdSchema }),
	output: activeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		getActiveEnvironment(requireSubject(ctx), input.workspaceId),
});

export const setActiveEnvironmentOperation = defineOperation({
	id: "client.setActiveEnvironment",
	method: "PUT",
	path: ACTIVE_PATH,
	summary: "Pick the environment you use in a workspace",
	description:
		"Your own choice; nobody else's changes. `environmentId: null` uses none. 409 ENVIRONMENT_NOT_IN_WORKSPACE for an environment of another workspace; 404 NOT_FOUND for one you hold no role on.",
	input: z.object({
		workspaceId: workspaceIdSchema,
		environmentId: environmentIdSchema.nullable(),
	}),
	output: activeView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		setActiveEnvironment(
			requireSubject(ctx),
			input.workspaceId,
			input.environmentId,
		),
});

export const getCollectionLocalValuesOperation = defineOperation({
	id: "client.getCollectionLocalValues",
	method: "GET",
	path: COLLECTION_LOCAL_PATH,
	summary: "Get your local values of a collection's variables",
	description:
		"Your own values, never synced; they override the collection's shared values when you send. 404 NOT_FOUND for a collection you cannot open.",
	input: z.object({ collectionId: collectionIdSchema }),
	output: localValuesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		localValues: await localValuesForCaller(
			ctx,
			await getCollectionLocalValues(requireSubject(ctx), input.collectionId),
			() => collectionSecrets(input.collectionId),
		),
	}),
});

export const setCollectionLocalValuesOperation = defineOperation({
	id: "client.setCollectionLocalValues",
	method: "PATCH",
	path: COLLECTION_LOCAL_PATH,
	summary: "Set or reset your local values of a collection's variables",
	description: `Any role that can open the collection. \`value: null\` resets one to the collection's value; names not listed keep theirs. 409 LOCAL_VALUES_LIMIT past the cap. ${AGENT_KEEPS_LOCAL}`,
	input: z.object({
		collectionId: collectionIdSchema,
		values: localValuesPatchSchema,
	}),
	output: localValuesOutput,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	bodyLimit: LOCAL_VALUES_BODY_LIMIT,
	handler: async (ctx, input) => {
		const secrets = () => collectionSecrets(input.collectionId);
		const values = await localPatchForCaller(ctx, input.values, secrets);
		return {
			localValues: await localValuesForCaller(
				ctx,
				await patchCollectionLocalValues(
					requireSubject(ctx),
					input.collectionId,
					values,
				),
				secrets,
			),
		};
	},
});

export const variableScopeOperations = [
	getActiveEnvironmentOperation,
	setActiveEnvironmentOperation,
	getCollectionLocalValuesOperation,
	setCollectionLocalValuesOperation,
] as const;
