import { toInputJsonSchema } from "./json-schema.js";
import type { OperationInputSchema } from "./types.js";

type ScalarKind = "number" | "boolean";
export type QueryCoercer = (
	query: Record<string, unknown>,
) => Record<string, unknown>;

function scalarKindOf(property: unknown): ScalarKind | null {
	if (typeof property !== "object" || property === null) return null;
	const type = "type" in property ? property.type : undefined;
	if (type === "integer" || type === "number") return "number";
	if (type === "boolean") return "boolean";
	return null;
}

function coerceValue(raw: unknown, kind: ScalarKind): unknown {
	if (typeof raw !== "string") return raw;
	if (kind === "boolean") {
		if (raw === "true") return true;
		if (raw === "false") return false;
		return raw;
	}
	const trimmed = raw.trim();
	if (trimmed === "") return raw;
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : raw;
}

/**
 * Query strings only carry text, while OpenAPI advertises the JSON Schema
 * types. Converting number and boolean fields here keeps `?limit=5` valid for
 * a `z.number()` field, matching what the generated docs promise. Values that
 * do not convert are passed through so zod reports the real error.
 */
export function createQueryCoercer(input: OperationInputSchema): QueryCoercer {
	const schema = toInputJsonSchema(input);
	const kinds = new Map<string, ScalarKind>();
	for (const [name, property] of Object.entries(schema.properties ?? {})) {
		const kind = scalarKindOf(property);
		if (kind) kinds.set(name, kind);
	}

	return (query) => {
		const coerced: Record<string, unknown> = {};
		for (const [name, raw] of Object.entries(query)) {
			const kind = kinds.get(name);
			coerced[name] = kind ? coerceValue(raw, kind) : raw;
		}
		return coerced;
	};
}
