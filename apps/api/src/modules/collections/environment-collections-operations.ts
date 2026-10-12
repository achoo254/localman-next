import { defineOperation } from "@localman/operations";
import { ENVIRONMENT_COLLECTIONS_MAX } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { ENVIRONMENT_ACCESS_NOTE } from "../environments/environment-access.js";
import { listEnvironmentCollections } from "./environment-collections-service.js";

export const listEnvironmentCollectionsOperation = defineOperation({
	id: "client.listEnvironmentCollections",
	method: "GET",
	path: "/environments/:environmentId/collections",
	summary: "List the collections that use an environment",
	description: `Where an environment is used: live collections of its workspace whose related environment it is, either linked by an Editor (\`source: "linked"\`) or shared together with the collection while none is linked (\`source: "shared"\`). Only collections the caller can open, by name, at most ${ENVIRONMENT_COLLECTIONS_MAX}. Anyone who can view the environment may ask. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({ environmentId: z.string().min(1).max(64) }),
	output: z.object({
		items: z.array(
			z.object({
				id: z.string(),
				name: z.string(),
				source: z.enum(["linked", "shared"]),
			}),
		),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listEnvironmentCollections(
			requireSubject(ctx),
			input.environmentId,
		),
	}),
});
