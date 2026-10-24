/**
 * The caller's local values as a variable table reads them: readable ones
 * by name, and the names whose value the vault keeps out of reach.
 */
import type { LocalValue } from "@localman/shared/api-client";

/**
 * Names whose local value is locked in the vault (`true`: unreadable for
 * good), unless an edit not saved yet replaced it (`pending`).
 */
export function lockedKeysOf(
	saved: readonly LocalValue[],
	pending: Readonly<Record<string, unknown>> = {},
): Map<string, boolean> {
	return new Map(
		saved
			.filter((entry) => entry.locked && !Object.hasOwn(pending, entry.key))
			.map((entry) => [entry.key, entry.unreadable === true] as const),
	);
}

/**
 * Readable local values after unsaved edits (`null`: reset to shared).
 * A value locked in the vault is left out: it is never written back,
 * moved to a new name or shared, since only its emptied stand-in is known.
 */
export function mergedLocal(
	saved: readonly LocalValue[],
	pending: Readonly<Record<string, string | null | undefined>>,
): Map<string, string> {
	const map = new Map(
		saved
			.filter((entry) => !entry.locked)
			.map((entry) => [entry.key, entry.value]),
	);
	for (const [key, value] of Object.entries(pending)) {
		if (value === null) map.delete(key);
		else if (value !== undefined) map.set(key, value);
	}
	return map;
}
