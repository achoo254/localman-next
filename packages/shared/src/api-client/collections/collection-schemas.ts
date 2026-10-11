/**
 * zod schemas of the collections API inputs (root edits, node create,
 * edit and move, examples, tab binding). Kept apart from the plain types
 * of `collection-model.ts` so a client that only needs the types does
 * not pull zod.
 */
import { z } from "zod";
import { utf8ByteLength } from "../byte-encoding.js";
import { MAX_HEADERS } from "../limits.js";
import { RAW_LANGUAGES } from "../request-model.js";
import {
	apiRequestDraftSchema,
	effectiveAuthSchema,
	keyValueRowSchema,
	requestAuthSchema,
	requestScriptsSchema,
} from "../request-schema.js";
import type { VariableEntry } from "../variable-interpolation.js";
import {
	COLLECTION_DESCRIPTION_MAX,
	COLLECTION_NAME_MAX,
	COLLECTION_VARIABLES_MAX,
	EXAMPLE_BODY_MAX,
	type ExampleResponse,
	type TabSource,
} from "./collection-model.js";
import {
	collectionStatusSchema,
	collectionTagsSchema,
} from "./collection-tags.js";

const name = z.string().trim().min(1).max(COLLECTION_NAME_MAX);
const description = z.string().max(COLLECTION_DESCRIPTION_MAX);
export const variableEntrySchema: z.ZodType<VariableEntry> = z.object({
	key: z.string().trim().min(1).max(200),
	value: z.string().max(10_000),
	secret: z.boolean().optional(),
	enabled: z.boolean().optional(),
});
const orderKey = z.string().min(1).max(200);

/** Body of `PATCH /collections/:id`: the root's editable fields. */
export const collectionUpdateSchema = z
	.object({
		name,
		description,
		auth: effectiveAuthSchema,
		scripts: requestScriptsSchema,
		variables: z.array(variableEntrySchema).max(COLLECTION_VARIABLES_MAX),
		tags: collectionTagsSchema,
		/** `null` clears the status. */
		status: collectionStatusSchema.nullable(),
	})
	.partial();

/** A saved response; `body` is cut to `EXAMPLE_BODY_MAX` before sending. */
export const exampleResponseSchema: z.ZodType<ExampleResponse> = z.object({
	/** An HTTP status code, as import reads one. */
	status: z.number().int().min(100).max(599),
	statusText: z.string().max(200),
	headers: z.array(keyValueRowSchema).max(MAX_HEADERS),
	/**
	 * At most `EXAMPLE_BODY_MAX` bytes of UTF-8 (a longer body is a 400
	 * VALIDATION_ERROR); the web cuts bodies by bytes before saving.
	 */
	body: z
		.string()
		.max(EXAMPLE_BODY_MAX)
		.refine((body) => utf8ByteLength(body) <= EXAMPLE_BODY_MAX, {
			message: `At most ${EXAMPLE_BODY_MAX} bytes of UTF-8`,
		}),
	bodyLanguage: z.enum(RAW_LANGUAGES),
});

/**
 * Body of `POST /collections/:id/nodes`: a new folder, request, or example
 * (its parent is a request node).
 */
export const nodeCreateSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("folder"),
		parentId: z.string().nullable(),
		name,
		/** Insert after this sibling; at the end when absent. */
		afterId: z.string().nullable().optional(),
	}),
	z.object({
		kind: z.literal("request"),
		parentId: z.string().nullable(),
		name,
		draft: apiRequestDraftSchema,
		afterId: z.string().nullable().optional(),
	}),
	z.object({
		kind: z.literal("example"),
		parentId: z.string(),
		name,
		request: apiRequestDraftSchema,
		response: exampleResponseSchema,
		afterId: z.string().nullable().optional(),
	}),
]);

/**
 * Body of `PATCH /collections/:id/nodes/:nodeId`, fields of that kind
 * only: folders name, description, auth, scripts; requests name,
 * description, draft; examples name, request, response.
 */
export const nodeUpdateSchema = z
	.object({
		name,
		description,
		auth: requestAuthSchema,
		scripts: requestScriptsSchema,
		draft: apiRequestDraftSchema,
		request: apiRequestDraftSchema,
		response: exampleResponseSchema,
	})
	.partial();

/** Body of `POST /collections/:id/nodes/:nodeId/move`: a drop. */
export const nodeMoveSchema = z.object({
	parentId: z.string().nullable(),
	/** Neighbours at the drop position (`null` at either end). */
	beforeOrder: orderKey.nullable(),
	afterOrder: orderKey.nullable(),
});

export const tabSourceSchema: z.ZodType<TabSource> = z.object({
	collectionId: z.string().min(1).max(64),
	nodeId: z.string().min(1).max(64),
});
