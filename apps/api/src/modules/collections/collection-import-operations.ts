import {
	type AnyOperation,
	OperationError,
	defineOperation,
} from "@localman/operations";
import {
	COLLECTION_IMPORT_FORMATS,
	COLLECTION_NAME_MAX,
	type CollectionTree,
	MAX_IMPORT_BYTES,
	type RequestImportParams,
	collectionTreeSchema,
	importText,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { workspaceIdSchema } from "./collection-read-operations.js";
import { createCollection } from "./collection-service.js";
import { collectionDetailView } from "./collection-view.js";
import { LIMITS_NOTE } from "./collection-write-operations.js";

const IMPORT_BODY_LIMIT = 2 * MAX_IMPORT_BYTES + 1024 * 1024;

const warningView = z.object({
	code: z.string(),
	path: z.string(),
	params: z.record(z.string(), z.union([z.string(), z.number()])),
});

function importFailed(
	reason: string,
	params: RequestImportParams = {},
): OperationError {
	return new OperationError(
		400,
		"IMPORT_FAILED",
		`The text could not be imported (${reason})`,
		{ reason, ...params },
	);
}

/**
 * Parses `text` like the import dialog of the web app and creates the
 * collection: what the browser does when a user imports a file, for an
 * agent that cannot run the browser's parser.
 */
async function importCollection(
	sub: string,
	input: { workspaceId: string; text: string; name?: string },
) {
	const { workspace } = await requireWorkspace(
		sub,
		"addElements",
		input.workspaceId,
	);
	await takeOperationSlot("import", sub, workspace._id.toHexString());
	const result = importText(input.text);
	if (!result.ok) throw importFailed(result.error.code, result.error.params);
	const imported = result.value;
	if (imported.format === "environment-v21") {
		throw new OperationError(
			400,
			"IMPORT_NOT_A_COLLECTION",
			"This is an environment file; import it with import_environment",
		);
	}
	const { format, warnings, ...rest } = imported;
	const tree: CollectionTree = rest;
	const checked = collectionTreeSchema.safeParse(tree);
	if (!checked.success) {
		throw importFailed("INVALID_TREE", {
			issue: checked.error.issues[0]?.message ?? "",
		});
	}
	const collection = await createCollection(sub, input.workspaceId, {
		tree: checked.data,
		...(input.name ? { name: input.name } : {}),
	});
	return { collection, format, warnings };
}

export const importCollectionOperation = defineOperation({
	id: "client.importCollection",
	method: "POST",
	path: "/workspaces/:workspaceId/collections/import",
	summary: "Import a collection from Postman v2.1, OpenAPI 3 JSON or cURL text",
	description: `Admins and Editors of the workspace. \`text\` is the file or command as written (at most ${MAX_IMPORT_BYTES} bytes): a Collection v2.1 JSON, an OpenAPI 3.x JSON document, or one cURL command; the format is detected like the import dialog of the web app. \`name\` renames the new collection. Answers the collection, the \`format\` found (${COLLECTION_IMPORT_FORMATS.join(", ")}) and \`warnings\` about what could not be carried over (code and the folder/request path). 400 IMPORT_FAILED with \`details.reason\` (INPUT_TOO_LARGE, EMPTY_INPUT, INVALID_JSON, YAML_NOT_SUPPORTED, UNKNOWN_FORMAT, UNSUPPORTED_VERSION, INVALID_CURL, UNTERMINATED_QUOTE, INVALID_DOCUMENT, TOO_COMPLEX, INVALID_TREE); 400 IMPORT_NOT_A_COLLECTION for an environment file (use import_environment). Counts toward the import rate limit (429 RATE_LIMITED). ${LIMITS_NOTE} 404 NOT_FOUND for a workspace the caller is not in.`,
	input: z.object({
		workspaceId: workspaceIdSchema,
		text: z.string().min(1),
		name: z.string().trim().min(1).max(COLLECTION_NAME_MAX).optional(),
	}),
	output: z.object({
		collection: collectionDetailView,
		format: z.enum(COLLECTION_IMPORT_FORMATS),
		warnings: z.array(warningView),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	successStatus: 201,
	// JSON escaping can nearly double the text: past it, IMPORT_FAILED says
	// INPUT_TOO_LARGE instead of the body parser's bare 413.
	bodyLimit: IMPORT_BODY_LIMIT,
	handler: async (ctx, input) => importCollection(requireSubject(ctx), input),
});

export const collectionImportOperations: readonly AnyOperation[] = [
	importCollectionOperation,
];
