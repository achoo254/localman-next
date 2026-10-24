/**
 * Small seeded random source (mulberry32) for the Vietnamese fake data
 * generators: the same seed gives the same data on the server and in the
 * browser, and the web bundle does not need Faker. Not for anything
 * secret: the output is predictable from the seed by design.
 */
export interface SeededRandom {
	/** A float in [0, 1). */
	next(): number;
	/** An integer in [min, max], both included. */
	int(min: number, max: number): number;
	/** One element of a non-empty list. */
	pick<T>(items: readonly T[]): T;
	/** One element, more likely the higher its `weight`. */
	weighted<T extends { readonly weight: number }>(items: readonly T[]): T;
	/** `length` random decimal digits, leading zeros kept. */
	digits(length: number): string;
}

const UINT32 = 2 ** 32;

/** A random source started from `seed` (any number, taken modulo 2^32). */
export function createSeededRandom(seed: number): SeededRandom {
	let state = Math.trunc(seed) >>> 0;
	const next = (): number => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / UINT32;
	};
	const int = (min: number, max: number): number =>
		min + Math.floor(next() * (max - min + 1));
	const pick = <T>(items: readonly T[]): T => {
		if (items.length === 0) throw new Error("Cannot pick from an empty list");
		return items[int(0, items.length - 1)];
	};
	return {
		next,
		int,
		pick,
		weighted: (items) => {
			const total = items.reduce((sum, item) => sum + item.weight, 0);
			let left = next() * total;
			for (const item of items) {
				left -= item.weight;
				if (left < 0) return item;
			}
			return pick(items);
		},
		digits: (length) =>
			Array.from({ length }, () => String(int(0, 9))).join(""),
	};
}
