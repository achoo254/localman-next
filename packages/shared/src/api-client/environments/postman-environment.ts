import { z } from "zod";
/**
 * Environments as Postman exports and imports them (`*.postman_environment.json`).
 * Only shared values travel: local values never leave their owner, and a
 * secret is always written blank (its type is kept). Pure, no Node API.
 */
import { brand } from "../../brand.js";
import {
	ENVIRONMENT_NAME_MAX,
	ENVIRONMENT_VARIABLES_MAX,
	type SharedVariable,
	VARIABLE_KEY_MAX,
	VARIABLE_VALUE_MAX,
	type VariableType,
} from "./environment-model.js";

export interface PostmanEnvironmentValue {
	key: string;
	value: string;
	type: VariableType;
	enabled: boolean;
}

export interface PostmanEnvironmentFile {
	id: string;
	name: string;
	values: PostmanEnvironmentValue[];
	_postman_variable_scope: "environment";
	_postman_exported_at: string;
	_postman_exported_using: string;
}

export interface PostmanEnvironmentSource {
	id: string;
	name: string;
	variables: readonly SharedVariable[];
}

export function toPostmanEnvironment(
	input: PostmanEnvironmentSource,
	exportedAt: Date,
): PostmanEnvironmentFile {
	return {
		id: input.id,
		name: input.name,
		values: input.variables.map((variable) => ({
			key: variable.key,
			value: variable.type === "secret" ? "" : (variable.sharedValue ?? ""),
			type: variable.type,
			enabled: variable.enabled,
		})),
		_postman_variable_scope: "environment",
		_postman_exported_at: exportedAt.toISOString(),
		_postman_exported_using: brand.appName,
	};
}

/** Characters no common file system accepts in a name. */
const RESERVED_FILE_CHARS = new Set([
	"\\",
	"/",
	":",
	"*",
	"?",
	'"',
	"<",
	">",
	"|",
]);

function safeFileChar(char: string): string {
	const code = char.charCodeAt(0);
	const control = code < 0x20 || code === 0x7f;
	return control || RESERVED_FILE_CHARS.has(char) ? "_" : char;
}

/** `<name>.postman_environment.json`, as Postman names its exports. */
export function postmanEnvironmentFileName(name: string): string {
	const base = [...name].map(safeFileChar).join("").trim() || "environment";
	return `${base}.postman_environment.json`;
}

export const POSTMAN_ENVIRONMENT_ISSUES = [
	"not_an_environment",
	"invalid_variable",
	"too_many_variables",
	"empty_key",
	"key_too_long",
	"duplicate_key",
	"value_too_long",
	"name_too_long",
] as const;
export type PostmanEnvironmentIssue =
	(typeof POSTMAN_ENVIRONMENT_ISSUES)[number];

export interface ImportedVariable {
	key: string;
	value: string;
	type: VariableType;
	enabled: boolean;
}

/**
 * The shared value an imported variable gets. Exports write a variable
 * nobody shares, and every secret, as `""`: a blank value imports as not
 * shared, so an export imported back keeps them unshared.
 */
export function importedSharedValue(variable: ImportedVariable): string | null {
	return variable.value === "" ? null : variable.value;
}

export type PostmanEnvironmentParse =
	| {
			ok: true;
			/** `null` when the file has no name. */
			name: string | null;
			variables: ImportedVariable[];
	  }
	| {
			ok: false;
			issue: PostmanEnvironmentIssue;
			/** Position of the variable at fault in `values`, when one is. */
			index?: number;
	  };

const fileShape = z.object({
	name: z.string().optional(),
	values: z.array(z.unknown()),
});

/** Older exports may hold numbers or booleans; `null` reads as blank. */
const valueShape = z.object({
	key: z.string(),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
	type: z.unknown().optional(),
	enabled: z.unknown().optional(),
});

type ValueRead =
	| { ok: true; variable: ImportedVariable }
	| { ok: false; issue: PostmanEnvironmentIssue };

/** Postman's legacy types (`text`, `any`) and unknown ones read as default. */
function readValue(raw: unknown): ValueRead {
	const parsed = valueShape.safeParse(raw);
	if (!parsed.success) return { ok: false, issue: "invalid_variable" };
	const key = parsed.data.key.trim();
	const value = String(parsed.data.value ?? "");
	if (!key) return { ok: false, issue: "empty_key" };
	if (key.length > VARIABLE_KEY_MAX)
		return { ok: false, issue: "key_too_long" };
	if (value.length > VARIABLE_VALUE_MAX) {
		return { ok: false, issue: "value_too_long" };
	}
	return {
		ok: true,
		variable: {
			key,
			value,
			type: parsed.data.type === "secret" ? "secret" : "default",
			enabled: parsed.data.enabled !== false,
		},
	};
}

export function parsePostmanEnvironment(raw: unknown): PostmanEnvironmentParse {
	const file = fileShape.safeParse(raw);
	if (!file.success) return { ok: false, issue: "not_an_environment" };
	const name = file.data.name?.trim() || null;
	if (name && name.length > ENVIRONMENT_NAME_MAX) {
		return { ok: false, issue: "name_too_long" };
	}
	if (file.data.values.length > ENVIRONMENT_VARIABLES_MAX) {
		return { ok: false, issue: "too_many_variables" };
	}
	const variables: ImportedVariable[] = [];
	const keys = new Set<string>();
	for (const [index, entry] of file.data.values.entries()) {
		const read = readValue(entry);
		if (!read.ok) return { ok: false, issue: read.issue, index };
		if (keys.has(read.variable.key)) {
			return { ok: false, issue: "duplicate_key", index };
		}
		keys.add(read.variable.key);
		variables.push(read.variable);
	}
	return { ok: true, name, variables };
}
