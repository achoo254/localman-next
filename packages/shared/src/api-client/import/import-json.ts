/**
 * Reading untrusted import input: size cap before parsing, `JSON.parse`
 * (never `eval`), depth and size caps after, and readers that only see
 * own properties. Importers never copy keys of the input into objects
 * with `obj[key] = …`, so `__proto__` or `constructor` in a file cannot
 * reach a prototype.
 */
import { utf8ByteLength } from "../byte-encoding.js";
import { RequestImportFailure } from "./import-error.js";

/** Largest import, as UTF-8 bytes of the pasted or uploaded text. */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
/** Deepest nesting of arrays and objects in an imported JSON document. */
export const MAX_IMPORT_JSON_DEPTH = 128;
/** Most values (objects, arrays, primitives) in an imported JSON document. */
export const MAX_IMPORT_JSON_NODES = 2_000_000;

export type JsonRecord = Readonly<Record<string, unknown>>;

/** Throws `EMPTY_INPUT` or `INPUT_TOO_LARGE`; returns the trimmed text. */
export function checkImportText(text: string): string {
	if (utf8ByteLength(text) > MAX_IMPORT_BYTES) {
		throw new RequestImportFailure("INPUT_TOO_LARGE", {
			max: MAX_IMPORT_BYTES,
		});
	}
	const trimmed = text.trim();
	if (!trimmed) throw new RequestImportFailure("EMPTY_INPUT");
	return trimmed;
}

/** Throws `TOO_COMPLEX` past the depth or node cap; stops early. */
function checkShape(root: unknown): void {
	let nodes = 0;
	const walk = (node: unknown, depth: number): void => {
		nodes += 1;
		if (depth > MAX_IMPORT_JSON_DEPTH || nodes > MAX_IMPORT_JSON_NODES) {
			throw new RequestImportFailure("TOO_COMPLEX", {
				max: depth > MAX_IMPORT_JSON_DEPTH ? MAX_IMPORT_JSON_DEPTH : nodes,
			});
		}
		if (Array.isArray(node)) {
			for (const item of node) walk(item, depth + 1);
		} else if (node !== null && typeof node === "object") {
			for (const item of Object.values(node)) walk(item, depth + 1);
		}
	};
	walk(root, 0);
}

/** Parses checked text as JSON and checks its shape. */
export function parseImportJson(text: string): unknown {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		throw new RequestImportFailure("INVALID_JSON");
	}
	checkShape(value);
	return value;
}

/** A JSON object (not an array, not `null`). */
export function isRecord(value: unknown): value is JsonRecord {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** `value[key]` when it is an own property, else `undefined`. */
export function prop(value: unknown, key: string): unknown {
	return isRecord(value) && Object.hasOwn(value, key) ? value[key] : undefined;
}

/** A string; numbers and booleans as text (`"1"`, `"true"`); else `null`. */
export function textOf(value: unknown): string | null {
	if (typeof value === "string") return value;
	if (typeof value === "number" && Number.isFinite(value)) {
		return String(value);
	}
	return typeof value === "boolean" ? String(value) : null;
}

/** `textOf(value[key])`, or `fallback`. */
export function textProp(value: unknown, key: string, fallback = ""): string {
	return textOf(prop(value, key)) ?? fallback;
}

/** `value[key]` as an array, or `[]`. */
export function listProp(value: unknown, key: string): readonly unknown[] {
	const found = prop(value, key);
	return Array.isArray(found) ? found : [];
}

/** `value[key]` as an object, or `null`. */
export function recordProp(value: unknown, key: string): JsonRecord | null {
	const found = prop(value, key);
	return isRecord(found) ? found : null;
}

/** Own keys of an object, in document order. */
export function keysOf(value: unknown): string[] {
	return isRecord(value) ? Object.keys(value) : [];
}

/** v2.1 and OpenAPI descriptions: a string or `{ content }`. */
export function descriptionOf(value: unknown): string {
	if (typeof value === "string") return value;
	return textProp(value, "content");
}
