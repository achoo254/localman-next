import { defineOperation } from "@localman/operations";
import {
	ENVIRONMENT_VARIABLES_MAX,
	VARIABLE_KEY_MAX,
	VARIABLE_VALUE_MAX,
	environmentNameSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { ENVIRONMENT_ACCESS_NOTE } from "./environment-access.js";
import {
	ENVIRONMENT_PATH,
	environmentIdSchema,
	workspaceIdSchema,
} from "./environment-inputs.js";
import {
	exportEnvironment,
	importEnvironment,
} from "./environment-transfer-service.js";
import { environmentDetailView } from "./environment-view.js";

/**
 * The largest valid file: every variable at its longest key and value,
 * 3 bytes of UTF-8 per character (a surrogate pair is 4 bytes for 2),
 * plus room for the JSON around them (types, flags, export metadata).
 * About 6 MB, so 10 MiB, which nginx's 16m for `/api/v1/workspaces/` lets
 * through.
 */
export const IMPORT_BODY_LIMIT = Math.max(
	10 * 1024 * 1024,
	ENVIRONMENT_VARIABLES_MAX * (VARIABLE_KEY_MAX + VARIABLE_VALUE_MAX) * 3 +
		1024 * 1024,
);

const postmanEnvironmentView = z.object({
	id: z.string(),
	name: z.string(),
	values: z.array(
		z.object({
			key: z.string(),
			value: z.string(),
			type: z.enum(["default", "secret"]),
			enabled: z.boolean(),
		}),
	),
	_postman_variable_scope: z.literal("environment"),
	_postman_exported_at: z.string(),
	_postman_exported_using: z.string(),
});

export const exportEnvironmentOperation = defineOperation({
	id: "client.exportEnvironment",
	method: "GET",
	path: `${ENVIRONMENT_PATH}/export`,
	summary: "Export an environment as a Postman environment file",
	description: `Any role. Returns the Postman environment JSON (\`environment\`) and a suggested \`fileName\`. Only shared values are exported: local values never are, a secret's value is always blank (its type is kept) and an unshared value is blank. ${ENVIRONMENT_ACCESS_NOTE}`,
	input: z.object({ environmentId: environmentIdSchema }),
	output: z.object({
		fileName: z.string(),
		environment: postmanEnvironmentView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		exportEnvironment(requireSubject(ctx), input.environmentId),
});

export const importEnvironmentOperation = defineOperation({
	id: "client.importEnvironment",
	method: "POST",
	path: "/workspaces/:workspaceId/environments/import",
	summary: "Import a Postman environment file into a workspace",
	description:
		"Admins and Editors of the workspace. `environment` is the Postman environment JSON (`{ name, values: [{ key, value, type, enabled }] }`); `name` overrides the file's name. Values become shared values; types other than `secret` become `default`; a blank value (as exports write a secret or an unshared variable) stays unshared; secrets are encrypted at rest. The body may hold up to 10 MiB (413 PAYLOAD_TOO_LARGE above). 400 INVALID_ENVIRONMENT_FILE names the problem (`details.issue`, and `details.index` of the variable at fault); 409 ENVIRONMENT_LIMIT_REACHED past the workspace's limit; 503 SECRET_STORAGE_UNAVAILABLE when a secret value cannot be encrypted. 404 NOT_FOUND for a workspace the caller is not in.",
	input: z.object({
		workspaceId: workspaceIdSchema,
		environment: z.unknown(),
		name: environmentNameSchema.optional(),
	}),
	output: environmentDetailView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	bodyLimit: IMPORT_BODY_LIMIT,
	handler: async (ctx, input) =>
		importEnvironment(requireSubject(ctx), input.workspaceId, {
			file: input.environment,
			name: input.name,
		}),
});

export const environmentTransferOperations = [
	exportEnvironmentOperation,
	importEnvironmentOperation,
] as const;
