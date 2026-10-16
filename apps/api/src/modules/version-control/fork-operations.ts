import { defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { requireCollection } from "../collections/collection-access.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { collectionDetailView } from "../collections/collection-view.js";
import {
	ENVIRONMENT_ACCESS_NOTE,
	requireEnvironment,
} from "../environments/environment-access.js";
import {
	ENVIRONMENT_PATH,
	environmentIdSchema,
} from "../environments/environment-inputs.js";
import { environmentDetailView } from "../environments/environment-view.js";
import {
	collectionForkStatus,
	forkCollection,
	listCollectionForks,
} from "./collection-fork-service.js";
import { applyMerge, previewMerge } from "./collection-merge-service.js";
import { applyPull, previewPull } from "./collection-pull-service.js";
import {
	environmentForkStatus,
	forkEnvironment,
	listEnvironmentForks,
} from "./environment-fork-service.js";
import {
	mergeEnvironment,
	previewEnvironmentSync,
	pullEnvironment,
} from "./environment-sync-service.js";
import { relabelFork } from "./fork-relabel.js";
import { labelSchema } from "./fork-views-schema.js";
import { syncOperations } from "./sync-operations.js";

const FORK =
	"Pro only (403 PLAN_FEATURE_UNAVAILABLE). Any role on the source; a Viewer forks into their personal workspace only (403 FORK_TARGET_NOT_ALLOWED), others into a workspace where they are Admin or Editor. The fork keeps the source's name and gets `label`; pull_*_changes and merge_*_fork keep the two in step.";

export const forkCollectionOperation = defineOperation({
	id: "client.forkCollection",
	method: "POST",
	path: `${COLLECTION_PATH}/forks`,
	summary: "Fork a collection",
	description: `A copy (folders, requests, examples, variables) linked to its source. ${FORK} ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		label: labelSchema,
		workspaceId: z.string().min(1).max(64),
	}),
	output: collectionDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) =>
		forkCollection(requireSubject(ctx), input.collectionId, input),
});

export const forkEnvironmentOperation = defineOperation({
	id: "client.forkEnvironment",
	method: "POST",
	path: `${ENVIRONMENT_PATH}/forks`,
	summary: "Fork an environment",
	description: `A copy of its variables linked to its source; a secret's value comes along only for an Editor of the source, and pull and merge never carry secret values. ${FORK} ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({
		environmentId: environmentIdSchema,
		label: labelSchema,
		workspaceId: z.string().min(1).max(64),
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) =>
		forkEnvironment(requireSubject(ctx), input.environmentId, input),
});

export const forkOperations = [
	forkCollectionOperation,
	...syncOperations({
		noun: "Collection",
		path: COLLECTION_PATH,
		param: "collectionId",
		note: ACCESS_NOTE,
		status: collectionForkStatus,
		list: listCollectionForks,
		relabel: async (sub, id, label) => {
			const { collectionId } = await requireCollection(sub, id, "edit");
			await relabelFork("collection", collectionId, label);
		},
		preview: (sub, id, direction) =>
			direction === "pull" ? previewPull(sub, id) : previewMerge(sub, id),
		pull: applyPull,
		merge: applyMerge,
	}),
	forkEnvironmentOperation,
	...syncOperations({
		noun: "Environment",
		path: ENVIRONMENT_PATH,
		param: "environmentId",
		note: ENVIRONMENT_ACCESS_NOTE,
		status: environmentForkStatus,
		list: listEnvironmentForks,
		relabel: async (sub, id, label) => {
			const { environmentId } = await requireEnvironment(sub, id, "edit");
			await relabelFork("environment", environmentId, label);
		},
		preview: previewEnvironmentSync,
		pull: pullEnvironment,
		merge: mergeEnvironment,
	}),
];
