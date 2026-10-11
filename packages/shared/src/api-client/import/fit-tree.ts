/**
 * The last step of every collection import: the tree cut to what
 * `POST /workspaces/:id/collections` accepts, so a valid file never fails
 * as a whole. Names are never blank (an example falls back to its
 * request's name) and fit `COLLECTION_NAME_MAX`; descriptions, scripts,
 * variables and example responses fit their limits. Drafts were already
 * clamped by the readers (`clampDraft`).
 */
import {
	COLLECTION_DESCRIPTION_MAX,
	COLLECTION_NAME_MAX,
	COLLECTION_VARIABLES_MAX,
	EXAMPLE_BODY_MAX,
	type ExampleResponse,
} from "../collections/collection-model.js";
import { MAX_HEADERS } from "../limits.js";
import type { VariableEntry } from "../variable-interpolation.js";
import { fitRows, fitScripts } from "./clamp-draft.js";
import { fitName, fitText, sliceUtf8 } from "./fit-text.js";
import { type ImportContext, joinPath } from "./import-context.js";
import type {
	CollectionTree,
	ImportedExample,
	ImportedItem,
} from "./imported-collection.js";

const VARIABLE_KEY_MAX = 200;
const VARIABLE_VALUE_MAX = 10_000;
const STATUS_TEXT_MAX = 200;

function fitVariables(
	variables: readonly VariableEntry[],
	ctx: ImportContext,
): VariableEntry[] {
	const keyed = variables.filter((variable) => variable.key.trim() !== "");
	if (keyed.length > COLLECTION_VARIABLES_MAX) {
		ctx.warn("TRUNCATED", "", { max: COLLECTION_VARIABLES_MAX });
	}
	return keyed.slice(0, COLLECTION_VARIABLES_MAX).map((variable) => ({
		...variable,
		key: fitText(variable.key, VARIABLE_KEY_MAX, ctx, ""),
		value: fitText(variable.value, VARIABLE_VALUE_MAX, ctx, ""),
	}));
}

function fitResponse(
	response: ExampleResponse,
	ctx: ImportContext,
	path: string,
): ExampleResponse {
	const body = sliceUtf8(response.body, EXAMPLE_BODY_MAX);
	if (body !== response.body) {
		ctx.warn("EXAMPLE_BODY_TRUNCATED", path, { max: EXAMPLE_BODY_MAX });
	}
	return {
		...response,
		statusText: fitText(response.statusText, STATUS_TEXT_MAX, ctx, path),
		headers: fitRows(response.headers, MAX_HEADERS, ctx, path),
		body,
	};
}

function fitExample(
	example: ImportedExample,
	requestName: string,
	ctx: ImportContext,
	path: string,
): ImportedExample {
	const at = joinPath(path, example.name);
	return {
		...example,
		name: fitName(example.name, requestName, COLLECTION_NAME_MAX, ctx, at),
		response: fitResponse(example.response, ctx, at),
	};
}

function fitItems(
	items: readonly ImportedItem[],
	ctx: ImportContext,
	parent: string,
): ImportedItem[] {
	return items.map((item): ImportedItem => {
		const path = joinPath(parent, item.name);
		const fallback = item.kind === "request" ? item.draft.url : "";
		const name = fitName(item.name, fallback, COLLECTION_NAME_MAX, ctx, path);
		const description = fitText(
			item.description,
			COLLECTION_DESCRIPTION_MAX,
			ctx,
			path,
		);
		if (item.kind === "folder") {
			const scripts = fitScripts(item.scripts, ctx, path);
			const items = fitItems(item.items, ctx, path);
			return { ...item, name, description, scripts, items };
		}
		const examples = item.examples.map((example) =>
			fitExample(example, name, ctx, path),
		);
		return { ...item, name, description, examples };
	});
}

export function fitTree<T extends CollectionTree>(
	tree: T,
	ctx: ImportContext,
): T {
	return {
		...tree,
		name: fitName(tree.name, "", COLLECTION_NAME_MAX, ctx, ""),
		description: fitText(tree.description, COLLECTION_DESCRIPTION_MAX, ctx, ""),
		scripts: fitScripts(tree.scripts, ctx, ""),
		variables: fitVariables(tree.variables, ctx),
		items: fitItems(tree.items, ctx, ""),
	};
}
