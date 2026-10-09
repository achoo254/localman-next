/** A value that survives `JSON.stringify` → `JSON.parse` unchanged. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

/** Bounds applied to user-supplied JSON (templates, responses, records). */
export interface JsonLimits {
	/** Deepest nesting of arrays and objects; the root is depth 0. */
	readonly maxDepth: number;
	/** Most values (every primitive, array and object counts once). */
	readonly maxNodes: number;
}

export const DEFAULT_JSON_LIMITS: JsonLimits = Object.freeze({
	maxDepth: 20,
	maxNodes: 10_000,
});

export interface JsonProblem {
	/** Dotted path of the offending value, `""` for the root. */
	readonly path: string;
	readonly message: string;
}

/**
 * Keys refused in user JSON and as schema field names. Mongoose silently
 * drops `__proto__` (stored data would differ from what the user sent),
 * and all three name prototype machinery that code reading the data with
 * `obj[key]` could trip over.
 */
export const FORBIDDEN_KEYS: readonly string[] = Object.freeze([
	"__proto__",
	"constructor",
	"prototype",
]);
const FORBIDDEN: ReadonlySet<string> = new Set(FORBIDDEN_KEYS);

/** An object literal or `JSON.parse` result (not an array or instance). */
export function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}
	const proto: unknown = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** Narrows a JSON value to an object (not an array or `null`). */
export function isJsonObject(value: JsonValue): value is JsonObject {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function joinPath(path: string, key: string | number): string {
	return path === "" ? String(key) : `${path}.${key}`;
}

export type JsonCheck =
	| { readonly ok: true; readonly value: JsonValue }
	| { readonly ok: false; readonly problems: readonly JsonProblem[] };

/**
 * Validates `value` as JSON within `limits` and returns a typed copy built
 * from own properties only. Reports non-JSON values (functions,
 * `undefined`, `NaN`, class instances), forbidden keys, excessive depth or
 * size; `visitString` lets callers add rules for string leaves (template
 * references). Stops at the first size or depth violation.
 */
export function checkJson(
	value: unknown,
	limits: JsonLimits = DEFAULT_JSON_LIMITS,
	visitString?: (text: string) => string | null,
): JsonCheck {
	const problems: JsonProblem[] = [];
	let nodes = 0;
	let stopped = false;
	const fail = (path: string, message: string): null => {
		problems.push({ path, message });
		return null;
	};
	const walk = (node: unknown, path: string, depth: number): JsonValue => {
		if (stopped) return null;
		nodes += 1;
		if (nodes > limits.maxNodes || depth > limits.maxDepth) {
			stopped = true;
			return fail(
				path,
				nodes > limits.maxNodes
					? `JSON has more than ${limits.maxNodes} values`
					: `JSON is nested deeper than ${limits.maxDepth} levels`,
			);
		}
		if (node === null || typeof node === "boolean") return node;
		if (typeof node === "number") {
			return Number.isFinite(node)
				? node
				: fail(path, "Numbers must be finite");
		}
		if (typeof node === "string") {
			const message = visitString?.(node) ?? null;
			return message ? fail(path, message) : node;
		}
		if (Array.isArray(node)) {
			return node.map((item, index) =>
				walk(item, joinPath(path, index), depth + 1),
			);
		}
		if (!isPlainObject(node)) return fail(path, "Value is not JSON");
		const entries: [string, JsonValue][] = [];
		for (const [key, item] of Object.entries(node)) {
			if (FORBIDDEN.has(key)) {
				fail(joinPath(path, key), `Key "${key}" is not allowed`);
			} else {
				entries.push([key, walk(item, joinPath(path, key), depth + 1)]);
			}
		}
		return Object.fromEntries(entries);
	};
	const copy = walk(value, "", 0);
	return problems.length === 0
		? { ok: true, value: copy }
		: { ok: false, problems };
}

/** Bytes of `text` in UTF-8, without allocating an encoded copy. */
export function utf8Length(text: string): number {
	let bytes = 0;
	for (let i = 0; i < text.length; i += 1) {
		const code = text.charCodeAt(i);
		if (code < 0x80) bytes += 1;
		else if (code < 0x800) bytes += 2;
		// A surrogate pair is one 4-byte code point: 2 bytes per half.
		else if (code >= 0xd800 && code <= 0xdfff) bytes += 2;
		else bytes += 3;
	}
	return bytes;
}

export interface JsonSize {
	/** Values, as counted by `checkJson`. */
	readonly nodes: number;
	/** Estimated bytes of the compact JSON text (escapes not counted). */
	readonly bytes: number;
}

/** Bytes a primitive adds to compact JSON text. */
export function primitiveBytes(value: JsonPrimitive): number {
	if (typeof value === "string") return utf8Length(value) + 2;
	return String(value).length;
}

/** Size of `value` as compact JSON. */
export function jsonSize(value: JsonValue): JsonSize {
	if (value === null || typeof value !== "object") {
		return { nodes: 1, bytes: primitiveBytes(value) };
	}
	let nodes = 1;
	let bytes = 2;
	const entries = Array.isArray(value)
		? value.map((item) => ["", item] as const)
		: Object.entries(value);
	entries.forEach(([key, item], index) => {
		const size = jsonSize(item);
		nodes += size.nodes;
		bytes += size.bytes + (index > 0 ? 1 : 0);
		if (!Array.isArray(value)) bytes += utf8Length(key) + 3;
	});
	return { nodes, bytes };
}
