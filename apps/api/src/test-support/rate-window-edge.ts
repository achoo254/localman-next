/**
 * TEST ONLY. Rate windows are fixed buckets aligned to multiples of their
 * `windowMs` (`lib/rate-limit-windows.ts`), so a burst that straddles an
 * edge starts a new count halfway and slips past the limit it was meant to
 * hit. A test that counts up to a limit awaits this first: with fewer than
 * `marginMs` left before the next edge, it waits past it, so the test's
 * setup and burst run inside one window. `marginMs` must outlast them.
 */
export async function startClearOfRateWindowEdge(
	windowMs: number,
	marginMs = 5_000,
): Promise<void> {
	const left = windowMs - (Date.now() % windowMs);
	if (left < marginMs) {
		await new Promise((resolve) => setTimeout(resolve, left + 50));
	}
}
