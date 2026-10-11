/**
 * Order keys of collection nodes: fractional index strings compared as
 * plain strings (code unit order, never `localeCompare`) within one
 * parent. A drop between two siblings takes a key between theirs, so only
 * the moved node is rewritten.
 */
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";

/** Base-62 digits after a letter that encodes the integer part's length. */
const ORDER_KEY_PATTERN = /^[A-Za-z][0-9A-Za-z]*$/;

/**
 * The library checks a key's length rules but not its alphabet nor that
 * `before < after` (it answers a key outside the range), so both are
 * checked here first.
 */
function assertRange(before: string | null, after: string | null): void {
	for (const key of [before, after]) {
		if (key !== null && !ORDER_KEY_PATTERN.test(key)) {
			throw new RangeError(`Invalid order key: ${key}`);
		}
	}
	if (before !== null && after !== null && before >= after) {
		throw new RangeError(`Order key ${before} is not below ${after}`);
	}
}

/**
 * A key strictly between `before` and `after` (`null` at either end).
 * Throws a RangeError (or the library's Error) when a key is malformed or
 * `before` is not below `after`.
 */
export function orderKeyBetween(
	before: string | null,
	after: string | null,
): string {
	assertRange(before, after);
	return generateKeyBetween(before, after);
}

/** `count` ascending keys between `before` and `after`, for bulk inserts. */
export function orderKeysBetween(
	before: string | null,
	after: string | null,
	count: number,
): string[] {
	assertRange(before, after);
	return generateNKeysBetween(before, after, count);
}

/** Sort comparator of order keys (ties broken by id, so the order is total). */
export function compareOrder(
	a: { order: string; id: string },
	b: { order: string; id: string },
): number {
	if (a.order !== b.order) return a.order < b.order ? -1 : 1;
	if (a.id === b.id) return 0;
	return a.id < b.id ? -1 : 1;
}
