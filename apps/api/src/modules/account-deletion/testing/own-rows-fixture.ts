import { PERSONAL_ROWS } from "./own-rows-personal.js";
import { SHARED_ROWS } from "./own-rows-shared.js";

export type OwnRow = readonly [
	name: string,
	seed: (sub: string) => Promise<unknown>,
	count: (sub: string) => Promise<number>,
];

/**
 * TEST ONLY. One row the account owns in every collection the deletion
 * empties, and how to count them back per account.
 */
const ROWS: readonly OwnRow[] = [...PERSONAL_ROWS, ...SHARED_ROWS];

/** TEST ONLY. Writes one row per collection for `sub`. */
export async function seedOwnRows(sub: string): Promise<void> {
	for (const [, seed] of ROWS) await seed(sub);
}

/** TEST ONLY. Rows `sub` still has, per collection. */
export async function countOwnRows(
	sub: string,
): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const [name, , count] of ROWS) counts[name] = await count(sub);
	return counts;
}

export const OWN_ROW_COLLECTIONS: readonly string[] = ROWS.map(
	([name]) => name,
);
