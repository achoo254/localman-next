import type { JsonObject, JsonValue } from "@localman/shared";

const NUMERIC_TEXT = /^-?\d+(?:\.\d+)?$/;

/**
 * Whether a `<field>=value` filter matches a record's value. The query
 * text is coerced to the value's type: strings match a case-insensitive
 * substring (the source's behaviour), numbers and booleans match exactly
 * (`completed=false`, `age=30`), `null` matches the text `null`. Objects
 * and arrays never match. `exact` fields (`id`, `{parent}Id`) compare the
 * whole string, so `userId=1` does not also return `10`.
 */
export function matchesFilter(
	value: JsonValue | undefined,
	wanted: string,
	exact: boolean,
): boolean {
	if (typeof value === "string") {
		return exact
			? value === wanted
			: value.toLowerCase().includes(wanted.toLowerCase());
	}
	if (typeof value === "number") {
		return NUMERIC_TEXT.test(wanted.trim()) && Number(wanted) === value;
	}
	if (typeof value === "boolean") return wanted.toLowerCase() === String(value);
	if (value === null) return wanted === "null";
	return false;
}

/**
 * `search`/`filter`: a case-insensitive substring of any string value at
 * the top level of the record (`id` included). `lowered` is lower case.
 */
export function matchesSearch(record: JsonObject, lowered: string): boolean {
	return Object.values(record).some(
		(value) =>
			typeof value === "string" && value.toLowerCase().includes(lowered),
	);
}

function asNumber(value: JsonValue | undefined): number | null {
	if (typeof value === "number") return value;
	if (typeof value === "string" && NUMERIC_TEXT.test(value))
		return Number(value);
	return null;
}

/** Numbers first, then strings, booleans, and missing or structured values. */
function rank(value: JsonValue | undefined): number {
	if (asNumber(value) !== null) return 0;
	if (typeof value === "string") return 1;
	if (typeof value === "boolean") return 2;
	return 3;
}

/**
 * Sort order of two field values: numerically when both are numbers or
 * numeric strings (ids "2" before "10"), else by code unit for strings,
 * `false` before `true`, and by type rank across types.
 */
export function compareValues(
	a: JsonValue | undefined,
	b: JsonValue | undefined,
): number {
	const left = asNumber(a);
	const right = asNumber(b);
	if (left !== null && right !== null) return left - right;
	if (typeof a === "string" && typeof b === "string") {
		return a < b ? -1 : a > b ? 1 : 0;
	}
	if (typeof a === "boolean" && typeof b === "boolean") {
		return Number(a) - Number(b);
	}
	return rank(a) - rank(b);
}
