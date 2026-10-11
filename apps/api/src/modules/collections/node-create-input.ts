import { OperationError } from "@localman/operations";
import {
	COLLECTION_NAME_MAX,
	apiRequestDraftSchema,
	exampleResponseSchema,
} from "@localman/shared/api-client";
import { z } from "zod";
import type { NodeCreate } from "./node-service.js";

const MIB = 1024 * 1024;
/**
 * JSON body of a node create or edit: a request draft (1 MiB) or an
 * example's request and response (body up to `EXAMPLE_BODY_MAX`, which
 * JSON escaping may double), with room around them.
 */
export const NODE_BODY_LIMIT = 4 * MIB;

export const nodeIdSchema = z.string().min(1).max(64);

/**
 * The body of a new node, flat as `nodeCreateSchema` describes it (an
 * operation input must be one object, not a union): a request needs a
 * draft, an example its request and response, a folder neither.
 */
export const createNodeInput = z.object({
	collectionId: z.string().min(1).max(64),
	kind: z.enum(["folder", "request", "example"]),
	parentId: nodeIdSchema.nullable(),
	name: z.string().trim().min(1).max(COLLECTION_NAME_MAX),
	afterId: nodeIdSchema.nullable().optional(),
	draft: apiRequestDraftSchema.optional(),
	request: apiRequestDraftSchema.optional(),
	response: exampleResponseSchema.optional(),
});

type CreateNodeInput = z.infer<typeof createNodeInput>;

function missing(path: string, message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", "Invalid input", [
		{ path, message },
	]);
}

function foreign(kind: string, fields: string[]): OperationError {
	return new OperationError(
		400,
		"INVALID_NODE_FIELDS",
		`A ${kind} has no ${fields.join(", ")}`,
		{ fields: fields.join(",") },
	);
}

/** The node to create, or 400 for a field missing or of another kind. */
export function nodeOf(input: CreateNodeInput): NodeCreate {
	const { kind, parentId, name, afterId, draft, request, response } = input;
	const sent = (fields: Record<string, unknown>) =>
		Object.entries(fields).flatMap(([key, value]) =>
			value === undefined ? [] : [key],
		);
	if (kind === "folder") {
		const extra = sent({ draft, request, response });
		if (extra.length > 0) throw foreign(kind, extra);
		return { kind, parentId, name, afterId };
	}
	if (kind === "request") {
		const extra = sent({ request, response });
		if (extra.length > 0) throw foreign(kind, extra);
		if (draft === undefined) throw missing("draft", "A request needs a draft");
		return { kind, parentId, name, afterId, draft };
	}
	if (draft !== undefined) throw foreign(kind, ["draft"]);
	if (parentId === null)
		throw missing("parentId", "An example belongs to a request");
	if (request === undefined)
		throw missing("request", "An example needs its request");
	if (response === undefined)
		throw missing("response", "An example needs its response");
	return { kind, parentId, name, afterId, request, response };
}
