/**
 * The zod schema of a `CollectionTree` sent to create a collection (an
 * import, or the "From mock project" template), with its bounds checked
 * before the recursive schema runs. The API validates request bodies with
 * it; tests validate imported fixtures against it.
 */
import { z } from "zod";
import type {
	CollectionTree,
	ImportedItem,
} from "../import/imported-collection.js";
import {
	apiRequestDraftSchema,
	effectiveAuthSchema,
	requestAuthSchema,
	requestScriptsSchema,
} from "../request-schema.js";
import {
	COLLECTION_DESCRIPTION_MAX,
	COLLECTION_NAME_MAX,
	COLLECTION_NODES_MAX,
	COLLECTION_VARIABLES_MAX,
} from "./collection-model.js";
import {
	exampleResponseSchema,
	variableEntrySchema,
} from "./collection-schemas.js";
import {
	collectionStatusSchema,
	collectionTagsSchema,
} from "./collection-tags.js";
import { COLLECTION_DEPTH_MAX } from "./collection-tree.js";

const name = z.string().trim().min(1).max(COLLECTION_NAME_MAX);
const description = z.string().max(COLLECTION_DESCRIPTION_MAX);
/** Ids of an import; the stored nodes get new ones. */
const itemId = z.string().min(1).max(200);

const itemSchema: z.ZodType<ImportedItem> = z.lazy(() =>
	z.discriminatedUnion("kind", [
		z.object({
			kind: z.literal("request"),
			id: itemId,
			name,
			description,
			draft: apiRequestDraftSchema,
			examples: z
				.array(
					z.object({
						id: itemId,
						name,
						request: apiRequestDraftSchema,
						response: exampleResponseSchema,
					}),
				)
				.max(COLLECTION_NODES_MAX)
				.default([]),
		}),
		z.object({
			kind: z.literal("folder"),
			id: itemId,
			name,
			description,
			auth: requestAuthSchema,
			scripts: requestScriptsSchema,
			items: z.array(itemSchema).max(COLLECTION_NODES_MAX),
		}),
	]),
);

function field(value: unknown, key: string): unknown {
	return typeof value === "object" && value !== null
		? Reflect.get(value, key)
		: undefined;
}

function childItems(value: unknown): unknown[] {
	const items = field(value, "items");
	return Array.isArray(items) ? items : [];
}

/**
 * Whether the raw tree nests folders deeper than `COLLECTION_DEPTH_MAX` (a
 * top-level folder is at depth 1) or holds more than
 * `COLLECTION_NODES_MAX` items. Walked without recursion before the
 * recursive schema runs, so a hostile body cannot exhaust the call stack
 * of the validator.
 */
export function exceedsBounds(tree: unknown): "depth" | "size" | null {
	const stack = childItems(tree).map((item) => ({ item, depth: 1 }));
	let count = 0;
	for (let next = stack.pop(); next; next = stack.pop()) {
		const examples = field(next.item, "examples");
		count += 1 + (Array.isArray(examples) ? examples.length : 0);
		if (count > COLLECTION_NODES_MAX) return "size";
		if (field(next.item, "kind") !== "folder") continue;
		if (next.depth > COLLECTION_DEPTH_MAX) return "depth";
		for (const item of childItems(next.item)) {
			stack.push({ item, depth: next.depth + 1 });
		}
	}
	return null;
}

/**
 * A `CollectionTree` sent to create a collection (an import, or the
 * "From mock project" template built by the web).
 */
export const collectionTreeSchema: z.ZodType<CollectionTree> = z.preprocess(
	(value, ctx) => {
		const exceeded = exceedsBounds(value);
		if (exceeded === "depth") {
			ctx.addIssue({
				code: "custom",
				message: `Folders nest at most ${COLLECTION_DEPTH_MAX} levels deep`,
			});
		} else if (exceeded === "size") {
			ctx.addIssue({
				code: "custom",
				message: `A collection holds at most ${COLLECTION_NODES_MAX} folders and requests`,
			});
		}
		return value;
	},
	z.object({
		name,
		description,
		auth: effectiveAuthSchema,
		variables: z.array(variableEntrySchema).max(COLLECTION_VARIABLES_MAX),
		scripts: requestScriptsSchema,
		items: z.array(itemSchema).max(COLLECTION_NODES_MAX),
		tags: collectionTagsSchema.default([]),
		status: collectionStatusSchema.nullable().default(null),
	}),
);
