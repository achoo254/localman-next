/**
 * Local `$ref` resolution for the OpenAPI importer: JSON Pointers into the
 * same document only (anything else is refused, never fetched), chains
 * bounded by `MAX_REF_CHAIN`, cycles reported as `REF_CYCLE`. Lookups use
 * own properties only, so `constructor` or `toString` never resolve.
 */
import { type JsonObject, type JsonValue, isJsonObject } from "./json-value.js";
import { SchemaImportFailure } from "./schema-import-fields.js";

/** Longest chain of `$ref` pointing at `$ref`. */
export const MAX_REF_CHAIN = 32;
const SCHEMA_REF = "#/components/schemas/";

export const failure = (
	code: SchemaImportFailure["code"],
	message: string,
): SchemaImportFailure => new SchemaImportFailure(code, message);
/** User text in an error message: quoted and cut to 200 characters. */
export const quote = (text: string): string =>
	JSON.stringify(text.slice(0, 200));

/** The value a local JSON Pointer (`#/components/schemas/User`) names. */
export function resolvePointer(root: JsonObject, ref: string): JsonValue {
	if (!ref.startsWith("#")) {
		throw failure(
			"EXTERNAL_REF",
			`Only local $ref is supported: ${quote(ref)}`,
		);
	}
	if (ref !== "#" && !ref.startsWith("#/")) {
		throw failure(
			"UNSUPPORTED",
			`Only JSON Pointer $ref is supported: ${quote(ref)}`,
		);
	}
	let node: JsonValue = root;
	for (const raw of ref === "#" ? [] : ref.slice(2).split("/")) {
		let key: string;
		try {
			key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");
		} catch {
			throw failure("INVALID_INPUT", `Malformed $ref ${quote(ref)}`);
		}
		const next: JsonValue | undefined = Array.isArray(node)
			? node[/^\d+$/.test(key) ? Number(key) : -1]
			: isJsonObject(node) && Object.hasOwn(node, key)
				? node[key]
				: undefined;
		if (next === undefined) {
			throw failure("SCHEMA_NOT_FOUND", `$ref ${quote(ref)} does not resolve`);
		}
		node = next;
	}
	return node;
}

/** Follows a chain of `$ref`; `ref` is the first one, if any. */
export function deref(
	root: JsonObject,
	node: JsonValue,
): { readonly value: JsonValue; readonly ref: string | null } {
	const seen: string[] = [];
	let value = node;
	while (isJsonObject(value) && typeof value.$ref === "string") {
		const ref = value.$ref;
		if (seen.includes(ref)) {
			throw failure("REF_CYCLE", `$ref cycle through ${quote(ref)}`);
		}
		if (seen.length >= MAX_REF_CHAIN) {
			throw failure("TOO_DEEP", `More than ${MAX_REF_CHAIN} chained $ref`);
		}
		seen.push(ref);
		value = resolvePointer(root, ref);
	}
	return { value, ref: seen[0] ?? null };
}

/** `User` for `#/components/schemas/User`, else `null`. */
export function componentName(ref: string | null): string | null {
	if (ref === null || !ref.startsWith(SCHEMA_REF)) return null;
	const name = ref.slice(SCHEMA_REF.length);
	return name.includes("/")
		? null
		: name.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** `node[key]` when it is an own property holding an object. */
export function objectAt(
	node: JsonValue | undefined,
	key: string,
): JsonObject | null {
	if (node === undefined || !isJsonObject(node) || !Object.hasOwn(node, key)) {
		return null;
	}
	const value = node[key];
	return value !== undefined && isJsonObject(value) ? value : null;
}
