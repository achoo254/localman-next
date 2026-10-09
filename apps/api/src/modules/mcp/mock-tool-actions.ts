import {
	MOCK_TOOL_ENDPOINTS,
	type MockToolAction,
	parentKeyOf,
} from "@localman/shared";
import type { ToolShape } from "./mock-tool-fields.js";
import {
	type ToolInputSchema,
	createInput,
	listInput,
	recordInput,
	updateInput,
} from "./mock-tool-schemas.js";

export type { MockToolAction };

export interface MockToolAnnotations {
	readonly readOnlyHint?: boolean;
	readonly destructiveHint?: boolean;
	readonly idempotentHint?: boolean;
}

interface ActionSpec {
	readonly verb: string;
	/**
	 * MCP assumes `destructiveHint: true` for any tool that is not
	 * read-only, so create and update say `false` explicitly.
	 */
	readonly annotations: MockToolAnnotations;
	readonly input: (shape: ToolShape) => ToolInputSchema;
}

/** Title verb, annotations and input of each action. */
export const ACTIONS: Readonly<Record<MockToolAction, ActionSpec>> = {
	list: {
		verb: "List",
		annotations: { readOnlyHint: true },
		input: listInput,
	},
	get: {
		verb: "Get",
		annotations: { readOnlyHint: true, idempotentHint: true },
		input: recordInput,
	},
	create: {
		verb: "Create",
		annotations: { readOnlyHint: false, destructiveHint: false },
		input: createInput,
	},
	update: {
		verb: "Update",
		annotations: {
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
		},
		input: updateInput,
	},
	delete: {
		verb: "Delete",
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
		},
		input: recordInput,
	},
};

/** Where a resource sits, for the tool description. */
export interface ToolPlace {
	readonly name: string;
	/** Names of the ancestor resources, outermost first. */
	readonly ancestors: readonly string[];
	/** Whether other resources nest under it (delete cascades). */
	readonly hasChildren: boolean;
}

/** `GET /users/{userId}/posts/{id}`: the nested REST route of `action`. */
function restRoute(action: MockToolAction, place: ToolPlace): string {
	const { method, path } = MOCK_TOOL_ENDPOINTS[action];
	const above = place.ancestors.map(
		(name) => `/${name}/{${parentKeyOf(name)}}`,
	);
	const one = path === "/:res/:id" ? "/{id}" : "";
	return `${method} ${above.join("")}/${place.name}${one}`;
}

/** Short English description of the tool for the agent. */
export function describeTool(action: MockToolAction, place: ToolPlace): string {
	const head = `mock resource "${place.name}" (${restRoute(action, place)})`;
	const parent = place.ancestors.at(-1);
	const parentNote = (what: string): string =>
		parent === undefined ? "" : ` parentId (a "${parent}" id) ${what}.`;
	switch (action) {
		case "list":
			return `List records of ${head}: search, filter by field, sort with sortBy/order, page with page/limit.${parentNote("lists one parent's records only")}`;
		case "get":
			return `Get one record of ${head} by id.`;
		case "create":
			return `Create a record in ${head}. The mock assigns the id and generates omitted fields.${parentNote("is required")}`;
		case "update":
			return `Update a record of ${head} by id: the given fields are merged, others are kept.`;
		case "delete":
			return `Delete a record of ${head} by id${place.hasChildren ? ", with every record nested under it" : ""}.`;
	}
}
