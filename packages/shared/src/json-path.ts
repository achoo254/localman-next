import { FORBIDDEN_KEYS } from "./json-value.js";

/** Longest JSONPath a conditional rule may hold. */
export const MAX_JSON_PATH_LENGTH = 200;
/** Most steps (`.key`, `[0]`) of one JSONPath. */
export const MAX_JSON_PATH_STEPS = 20;

/** One step of a JSONPath: an object key or an array index. */
export type JsonPathStep = string | number;

// `.key`, `[0]`, `['key']` or `["key"]`, read from the current position.
const STEP =
	/\.([A-Za-z0-9_$-]+)|\[(\d{1,6})\]|\['([^'\]]{1,100})'\]|\["([^"\]]{1,100})"\]/y;

/**
 * Parses the small JSONPath subset rules use: `$` followed by `.key`,
 * `['key']` / `["key"]` (for keys with dots or spaces) and `[index]`.
 * No wildcards, filters, slices or recursive descent, and nothing is ever
 * evaluated. `null` when the path is outside the subset, too long, or
 * names a key of `FORBIDDEN_KEYS`.
 */
export function parseJsonPath(path: string): JsonPathStep[] | null {
	if (path.length > MAX_JSON_PATH_LENGTH || !path.startsWith("$")) return null;
	const steps: JsonPathStep[] = [];
	let index = 1;
	while (index < path.length) {
		STEP.lastIndex = index;
		const match = STEP.exec(path);
		if (!match) return null;
		const [, dotKey, arrayIndex, single, double] = match;
		const key = dotKey ?? single ?? double;
		if (key !== undefined) {
			if (FORBIDDEN_KEYS.includes(key)) return null;
			steps.push(key);
		} else {
			steps.push(Number(arrayIndex));
		}
		if (steps.length > MAX_JSON_PATH_STEPS) return null;
		index = STEP.lastIndex;
	}
	return steps;
}

/**
 * The value at `steps` inside `value`, or `undefined` when a step is
 * missing. Keys are read with `Object.hasOwn` on plain objects only and
 * indexes on arrays only, so the prototype chain is never reached.
 */
export function readJsonPath(
	value: unknown,
	steps: readonly JsonPathStep[],
): unknown {
	let current: unknown = value;
	for (const step of steps) {
		if (typeof step === "number") {
			if (!Array.isArray(current) || step >= current.length) return undefined;
			current = current[step];
		} else {
			if (
				typeof current !== "object" ||
				current === null ||
				Array.isArray(current) ||
				!Object.hasOwn(current, step)
			) {
				return undefined;
			}
			current = (current as Record<string, unknown>)[step];
		}
	}
	return current;
}
