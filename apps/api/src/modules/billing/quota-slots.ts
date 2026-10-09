/**
 * Counted quotas (projects, resources) number each owned item with a
 * `quotaSlot` under a unique `(owner, quotaSlot)` index. Creators read the
 * taken slots, check the plan, then claim the lowest free ones: racers that
 * read the same state claim the same slots, so only one insert wins and the
 * others re-read and re-check instead of all passing the limit.
 */

/** The `count` lowest slot numbers that are not in `taken`. */
export function lowestFreeSlots(
	taken: readonly number[],
	count: number,
): number[] {
	const used = new Set(taken);
	const free: number[] = [];
	for (let slot = 0; free.length < count; slot += 1) {
		if (!used.has(slot)) free.push(slot);
	}
	return free;
}

/**
 * Every losing racer retries; each round lets at least one create through,
 * so only a burst this large from one owner can exhaust the attempts.
 */
export const MAX_QUOTA_ATTEMPTS = 25;
