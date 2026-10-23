import { type AnyOperation, defineOperation } from "@localman/operations";
import { z } from "zod";
import {
	USER_SCOPE,
	isAgentCall,
	requireSubject,
} from "../../http/require-auth.js";
import { requireProject } from "../projects/project-service.js";
import { projectIdParam } from "../resources/resource-operation-params.js";
import {
	mergePreviewView,
	resolutionsSchema,
} from "../version-control/fork-views-schema.js";
import {
	AGENT_PREVIEW,
	withholdPreviewSecrets,
} from "../version-control/merge-views.js";
import { createSyncedCollection } from "./sync-create-service.js";
import {
	previewSync,
	resolveSync,
	stopSync,
	syncStatus,
	syncedCollectionsOf,
} from "./sync-link-service.js";
import { DEFAULT_SYNC_NAMES, syncNamesSchema } from "./sync-names.js";
import "./sync-project-dependent.js";

const collectionId = z.string().min(1).max(64);
const base = {
	scopes: [USER_SCOPE],
	toolset: "sync" as const,
	mcp: true as const,
};
const readOnly = { readOnly: true, destructive: false, idempotent: true };

const ABOUT =
	"Live Mock Sync keeps a collection in step with a mock project: about 2 seconds after a resource is added, renamed, nested, deleted or its schema, endpoints or the project's prefix change, the collection's requests follow (author Live Mock Sync in the changelog). What a user edited in a request stays; a mock change to the same field is a conflict that keeps the user's value until resolved. Requests the mock stops serving move to the `_removed` folder.";

const statusView = z.object({
	collectionId: z.string(),
	project: z.object({ id: z.string(), name: z.string() }).nullable(),
	environmentId: z.string().nullable(),
	lastSyncedAt: z.string(),
	syncCount: z.number().int(),
	conflicts: z.number().int(),
	canManage: z.boolean(),
});

export const liveMockSyncOperations: readonly AnyOperation[] = [
	defineOperation({
		...base,
		id: "sync.createSyncedCollection",
		method: "POST",
		path: "/projects/:projectId/synced-collections",
		summary: "Create a collection that stays in sync with a mock project",
		description: `${ABOUT} Makes the collection (a folder per resource, a request per enabled endpoint on {{baseUrl}}, sample bodies from the schema, an example answer per GET) and an environment with \`baseUrl\` and one id variable per resource, linked to it. Editors of the project who add elements to the workspace. \`names\` sets the request names (\`{name}\` is the resource), default English. 404 NOT_FOUND for a project or workspace out of reach.`,
		input: z.object({
			projectId: projectIdParam,
			workspaceId: z.string().min(1).max(64),
			names: syncNamesSchema.optional(),
		}),
		output: z.object({ collectionId: z.string(), environmentId: z.string() }),
		annotations: { readOnly: false, destructive: false, idempotent: false },
		successStatus: 201,
		handler: async (ctx, input) => {
			const made = await createSyncedCollection(
				requireSubject(ctx),
				input.projectId,
				input.workspaceId,
				input.names ?? DEFAULT_SYNC_NAMES,
			);
			return {
				collectionId: made.collection.id,
				environmentId: made.environmentId,
			};
		},
	}),
	defineOperation({
		...base,
		id: "sync.listProjectSyncedCollections",
		method: "GET",
		path: "/projects/:projectId/synced-collections",
		summary: "List the collections synced with a mock project",
		description:
			"Those the caller can open, for 'Open synced collection'. Readers of the project.",
		input: z.object({ projectId: projectIdParam }),
		output: z.object({
			items: z.array(z.object({ collectionId: z.string(), name: z.string() })),
		}),
		annotations: readOnly,
		handler: async (ctx, input) => {
			const sub = requireSubject(ctx);
			const project = await requireProject(sub, "read", input.projectId);
			return { items: await syncedCollectionsOf(sub, project) };
		},
	}),
	defineOperation({
		...base,
		id: "sync.getCollectionSync",
		method: "GET",
		path: "/collections/:collectionId/mock-sync",
		summary: "Get the Live Mock Sync status of a collection",
		description: `${ABOUT} Any role on the collection; the project is named only to its readers. \`conflicts\` counts clashes waiting for a choice. 404 NOT_SYNCED when the collection does not follow a mock.`,
		input: z.object({ collectionId }),
		output: statusView,
		annotations: readOnly,
		handler: async (ctx, input) =>
			syncStatus(requireSubject(ctx), input.collectionId),
	}),
	defineOperation({
		...base,
		id: "sync.previewCollectionSync",
		method: "GET",
		path: "/collections/:collectionId/mock-sync/preview",
		summary: "Preview the mock's pending changes and their conflicts",
		description: `What applying the mock's changes would do and the conflicts to choose for: \`source\` is the mock, \`destination\` the collection. Any role. ${AGENT_PREVIEW}`,
		input: z.object({ collectionId }),
		output: mergePreviewView,
		annotations: readOnly,
		handler: async (ctx, input) => {
			const preview = await previewSync(
				requireSubject(ctx),
				input.collectionId,
			);
			return isAgentCall(ctx) ? withholdPreviewSecrets(preview) : preview;
		},
	}),
	defineOperation({
		...base,
		id: "sync.resolveCollectionSync",
		method: "POST",
		path: "/collections/:collectionId/mock-sync/resolve",
		summary: "Resolve Live Mock Sync conflicts and apply the mock's changes",
		description:
			"Editors of the collection. `resolutions` maps each conflict id of the preview to `source` (take the mock's value) or `destination` (keep the collection's); 409 MERGE_CONFLICTS while one lacks a choice.",
		input: z.object({ collectionId, resolutions: resolutionsSchema }),
		output: statusView,
		annotations: { readOnly: false, destructive: false, idempotent: true },
		handler: async (ctx, input) =>
			resolveSync(requireSubject(ctx), input.collectionId, input.resolutions),
	}),
	defineOperation({
		...base,
		id: "sync.stopCollectionSync",
		method: "DELETE",
		path: "/collections/:collectionId/mock-sync",
		summary: "Stop syncing a collection with its mock project",
		description:
			"The collection becomes an ordinary one and keeps its content. Editors of the collection who are also Editors of the project (403 FORBIDDEN otherwise); once the project is gone, Editors of the collection.",
		input: z.object({ collectionId }),
		output: z.object({ stopped: z.literal(true) }),
		annotations: { readOnly: false, destructive: false, idempotent: false },
		handler: async (ctx, input) => {
			await stopSync(requireSubject(ctx), input.collectionId);
			return { stopped: true as const };
		},
	}),
];
