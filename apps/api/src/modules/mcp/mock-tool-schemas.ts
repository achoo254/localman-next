import {
	MAX_PAGE_LIMIT,
	MAX_SCHEMA_FIELDS,
	MOCK_QUERY_PARAMS,
	OBJECT_ID_FIELD,
	RECORD_ID_MAX,
} from "@localman/shared";
import {
	type JsonSchema,
	type ToolShape,
	dataFields,
	fieldName,
	fieldValueSchema,
	filterDescription,
	filterType,
	isQuerySafe,
} from "./mock-tool-fields.js";

export const JSON_SCHEMA_DIALECT =
	"https://json-schema.org/draft/2020-12/schema";

/** `inputSchema` of an MCP tool: always a closed object. */
export interface ToolInputSchema extends JsonSchema {
	readonly $schema: typeof JSON_SCHEMA_DIALECT;
	readonly type: "object";
	readonly properties: Readonly<Record<string, JsonSchema>>;
	readonly required: readonly string[];
	readonly additionalProperties: false;
}

/** Argument naming the parent record of a nested resource. */
export const PARENT_ID_ARG = "parentId";
/** Argument naming the record of get/update/delete. */
export const RECORD_ID_ARG = "id";
/** Argument holding the record fields of create/update. */
export const DATA_ARG = "data";

const [SEARCH] = MOCK_QUERY_PARAMS.search;
const [PAGE] = MOCK_QUERY_PARAMS.page;
const [LIMIT] = MOCK_QUERY_PARAMS.limit;
const [SORT_BY] = MOCK_QUERY_PARAMS.sort;
const [ORDER] = MOCK_QUERY_PARAMS.order;
/** Every query name the REST list reads itself, aliases included. */
const QUERY_NAMES: readonly string[] = Object.values(MOCK_QUERY_PARAMS).flat();

/**
 * A record id as the mock API takes it in a path segment: the rule of
 * `RECORD_ID_PATTERN` in `resources/record-input.ts`.
 */
function recordIdSchema(description: string): JsonSchema {
	return {
		type: "string",
		minLength: 1,
		maxLength: RECORD_ID_MAX,
		pattern: "^(?=.*[A-Za-z0-9])[A-Za-z0-9_.~-]+$",
		description,
	};
}

function inputSchema(
	properties: Record<string, JsonSchema>,
	required: readonly string[],
): ToolInputSchema {
	return {
		$schema: JSON_SCHEMA_DIALECT,
		type: "object",
		properties,
		required,
		additionalProperties: false,
	};
}

/** `parentId` of a nested resource; nothing for a root resource. */
function parentArg(shape: ToolShape, role: string): Record<string, JsonSchema> {
	if (shape.parentName === null) return {};
	const parent = `Id of the parent "${shape.parentName}" record`;
	return { [PARENT_ID_ARG]: recordIdSchema(`${parent}; ${role}`) };
}

/**
 * `list_<res>`: the REST list query under the primary parameter names,
 * plus one filter per field the REST list can filter on. Fields named
 * like a query parameter (any alias) or `parentId` are left out, as the
 * REST list cannot filter them either.
 */
export function listInput(shape: ToolShape): ToolInputSchema {
	const reserved = new Set(QUERY_NAMES);
	if (shape.parentName !== null) reserved.add(PARENT_ID_ARG);
	const fields = dataFields(shape);
	const filters = fields.flatMap((field): [string, JsonSchema][] => {
		const name = fieldName(field);
		const type = filterType(field, shape.template);
		if (type === null || reserved.has(name) || !isQuerySafe(name)) return [];
		return [[name, { type, description: filterDescription(name, type) }]];
	});
	const sortable = [
		OBJECT_ID_FIELD,
		...(shape.parentKey === null ? [] : [shape.parentKey]),
		...fields.map(fieldName).filter(isQuerySafe),
	];
	return inputSchema(
		{
			...parentArg(shape, "only its records are listed (omit for all)"),
			[SEARCH]: {
				type: "string",
				description:
					"Case-insensitive text matched against every top-level string value",
			},
			...Object.fromEntries(filters),
			[SORT_BY]: {
				type: "string",
				enum: [...new Set(sortable)],
				description: "Field to sort by",
			},
			[ORDER]: {
				type: "string",
				enum: ["asc", "desc"],
				description: "Sort direction (default asc)",
			},
			[PAGE]: {
				type: "integer",
				minimum: 1,
				description: "1-based page number, used with limit",
			},
			[LIMIT]: {
				type: "integer",
				minimum: 1,
				maximum: MAX_PAGE_LIMIT,
				description: `Records per page (at most ${MAX_PAGE_LIMIT}); omit to get every match`,
			},
		},
		[],
	);
}

/**
 * Record fields of create/update. A schema gives typed, closed fields
 * (the schema has no required flag and POST generates missing fields,
 * so none is required). An object template gives a free object whose
 * known keys are listed, capped in size.
 */
function dataSchema(shape: ToolShape, description: string): JsonSchema {
	const fields = dataFields(shape);
	if (shape.template) {
		const keys = fields.map(fieldName);
		return {
			type: "object",
			description: `${description} Keys of the object template are listed; others are allowed.`,
			properties: Object.fromEntries(keys.map((key) => [key, {}])),
			additionalProperties: true,
			maxProperties: Math.max(MAX_SCHEMA_FIELDS, keys.length),
		};
	}
	return {
		type: "object",
		description,
		properties: Object.fromEntries(
			fields.map((field) => [fieldName(field), fieldValueSchema(field)]),
		),
		additionalProperties: false,
	};
}

/** `get_<res>` and `delete_<res>`. */
export function recordInput(shape: ToolShape): ToolInputSchema {
	return inputSchema(
		{
			...parentArg(shape, "when given, the record must belong to it"),
			[RECORD_ID_ARG]: recordIdSchema("Id of the record"),
		},
		[RECORD_ID_ARG],
	);
}

/** `create_<res>`: no `id` (the mock assigns it). */
export function createInput(shape: ToolShape): ToolInputSchema {
	const data = dataSchema(
		shape,
		"Fields of the new record; omitted fields get generated values.",
	);
	return inputSchema(
		{ ...parentArg(shape, "the new record belongs to it"), [DATA_ARG]: data },
		shape.parentName === null ? [] : [PARENT_ID_ARG],
	);
}

export function updateInput(shape: ToolShape): ToolInputSchema {
	const data = dataSchema(
		shape,
		"Fields to change; they are merged into the record, others are kept.",
	);
	return inputSchema(
		{
			...parentArg(shape, "when given, the record must belong to it"),
			[RECORD_ID_ARG]: recordIdSchema("Id of the record"),
			[DATA_ARG]: data,
		},
		[RECORD_ID_ARG, DATA_ARG],
	);
}
