/**
 * Local `$ref` resolution and example values for the OpenAPI importer.
 * Only JSON Pointers into the same document are followed (never fetched);
 * a schema that refers to itself stops the example at that point. Example
 * objects are built with `Object.fromEntries`, so a property named
 * `__proto__` stays an ordinary key.
 */
import type { ImportContext } from "./import-context.js";
import { paramText } from "./import-error.js";
import {
	type JsonRecord,
	isRecord,
	keysOf,
	listProp,
	prop,
	recordProp,
	textOf,
} from "./import-json.js";

/** Longest chain of `$ref` pointing at `$ref`. */
const MAX_REF_CHAIN = 32;
/** Nesting of a generated example. */
const MAX_EXAMPLE_DEPTH = 12;
/** Values in one generated example. */
const MAX_EXAMPLE_NODES = 5000;

function resolvePointer(root: JsonRecord, ref: string): unknown {
	let node: unknown = root;
	for (const raw of ref.slice(2).split("/")) {
		let key: string;
		try {
			key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
		} catch {
			return undefined;
		}
		node = Array.isArray(node)
			? node[/^\d+$/.test(key) ? Number(key) : -1]
			: prop(node, key);
		if (node === undefined) return undefined;
	}
	return node;
}

/**
 * `node` with its `$ref` chain followed; `null` (and a warning) when a
 * reference is external, missing or loops.
 */
export function derefLocal(
	root: JsonRecord,
	node: unknown,
	ctx: ImportContext,
	path: string,
): unknown {
	const seen: string[] = [];
	let value = node;
	for (;;) {
		const ref = textOf(prop(value, "$ref"));
		if (ref === null) return value;
		const next =
			ref.startsWith("#/") && !seen.includes(ref) && seen.length < MAX_REF_CHAIN
				? resolvePointer(root, ref)
				: undefined;
		if (next === undefined) {
			ctx.warn("UNRESOLVED_REF", path, { ref: paramText(ref) });
			return null;
		}
		seen.push(ref);
		value = next;
	}
}

const STRING_FORMATS: Readonly<Record<string, string>> = {
	"date-time": "2026-01-01T00:00:00Z",
	date: "2026-01-01",
	time: "00:00:00",
	email: "user@example.com",
	uuid: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
	uri: "https://example.com",
	url: "https://example.com",
	hostname: "example.com",
	ipv4: "192.0.2.1",
	ipv6: "2001:db8::1",
	binary: "",
	byte: "",
};

/** `type` of a 3.0 schema, or the first non-null one of a 3.1 list. */
function schemaType(schema: JsonRecord): string | null {
	const type = prop(schema, "type");
	if (typeof type === "string") return type;
	const listed = Array.isArray(type)
		? type.find((t) => typeof t === "string" && t !== "null")
		: undefined;
	if (typeof listed === "string") return listed;
	if (prop(schema, "properties") !== undefined) return "object";
	return prop(schema, "items") !== undefined ? "array" : null;
}

/** A value the schema itself gives: `example`, `examples[0]`, `default`… */
export function declaredExample(schema: unknown): unknown {
	for (const key of ["example", "default", "const"]) {
		const found = prop(schema, key);
		if (found !== undefined) return found;
	}
	const examples = prop(schema, "examples");
	if (Array.isArray(examples) && examples.length > 0) return examples[0];
	const options = listProp(schema, "enum");
	return options.length > 0 ? options[0] : undefined;
}

/** An example value for `schema`; `null` past the depth or size cap. */
export function exampleFromSchema(
	root: JsonRecord,
	schema: unknown,
	ctx: ImportContext,
	path: string,
): unknown {
	let nodes = 0;
	const walk = (node: unknown, depth: number, refs: string[]): unknown => {
		nodes += 1;
		if (depth > MAX_EXAMPLE_DEPTH || nodes > MAX_EXAMPLE_NODES) return null;
		const ref = textOf(prop(node, "$ref"));
		if (ref !== null && refs.includes(ref)) return null;
		const value = derefLocal(root, node, ctx, path);
		if (!isRecord(value)) return null;
		const chain = ref === null ? refs : [...refs, ref];
		const declared = declaredExample(value);
		if (declared !== undefined) return declared;
		const allOf = listProp(value, "allOf");
		if (allOf.length > 0) {
			const parts = allOf.map((part) => walk(part, depth + 1, chain));
			const entries = parts.flatMap((part) =>
				isRecord(part) ? Object.entries(part) : [],
			);
			return entries.length > 0 ? Object.fromEntries(entries) : parts[0];
		}
		for (const key of ["oneOf", "anyOf"]) {
			const first = listProp(value, key)[0];
			if (first !== undefined) return walk(first, depth + 1, chain);
		}
		switch (schemaType(value)) {
			case "object": {
				const properties = recordProp(value, "properties");
				return Object.fromEntries(
					keysOf(properties).map((key) => [
						key,
						walk(prop(properties, key), depth + 1, chain),
					]),
				);
			}
			case "array": {
				const items = prop(value, "items");
				return items === undefined ? [] : [walk(items, depth + 1, chain)];
			}
			case "string":
				return STRING_FORMATS[textOf(prop(value, "format")) ?? ""] ?? "string";
			case "integer":
			case "number": {
				const minimum = prop(value, "minimum");
				return typeof minimum === "number" ? minimum : 0;
			}
			case "boolean":
				return true;
			default:
				return null;
		}
	};
	return walk(schema, 0, []);
}

/** Text of an example for a query, header or form field. */
export function exampleText(value: unknown): string {
	if (value === undefined || value === null) return "";
	if (Array.isArray(value)) return value.map(exampleText).join(",");
	return textOf(value) ?? JSON.stringify(value);
}
