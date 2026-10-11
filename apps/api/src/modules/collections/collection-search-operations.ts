import { defineOperation } from "@localman/operations";
import {
	COLLECTION_SEARCH_QUERY_MAX,
	COLLECTION_SEARCH_RESULTS_MAX,
	HTTP_METHODS,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { workspaceIdSchema } from "./collection-read-operations.js";
import { searchCollections } from "./collection-search-service.js";

const matchView = z.object({
	collectionId: z.string(),
	collectionName: z.string(),
	nodeId: z.string().nullable(),
	kind: z.enum(["collection", "folder", "request"]),
	name: z.string(),
	method: z.enum(HTTP_METHODS).optional(),
	path: z.array(z.string()),
});

export const searchCollectionsOperation = defineOperation({
	id: "client.searchCollections",
	method: "GET",
	path: "/workspaces/:workspaceId/collections/search",
	summary: "Search collections, folders and requests of a workspace by name",
	description: `Names holding \`q\` (case and accents ignored, so "cafe" finds "Café"), among the collections the caller may open in the workspace (members: all; others: those shared with them, 404 NOT_FOUND when none). At most ${COLLECTION_SEARCH_RESULTS_MAX} matches, collections first; \`truncated\` says more matched. Each folder or request comes with its collection and the names of the folders above it (\`path\`); requests with their method.`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		q: z.string().trim().min(1).max(COLLECTION_SEARCH_QUERY_MAX),
	}),
	output: z.object({ matches: z.array(matchView), truncated: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		searchCollections(requireSubject(ctx), input.workspaceId, input.q),
});
