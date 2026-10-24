/**
 * The local values of one scope are written one at a time, in the order
 * they were asked for (the table's autosave, scripts, "Let agents use"),
 * so a write worked out from older data never lands after a newer one.
 */
const tails = new Map<string, Promise<void>>();

/** Runs `task` once every earlier write of `path` has settled. */
export function inLocalQueue<T>(
	path: string,
	task: () => Promise<T>,
): Promise<T> {
	const before = tails.get(path) ?? Promise.resolve();
	const run = before.then(task);
	const tail = run.then(
		() => undefined,
		() => undefined,
	);
	tails.set(path, tail);
	void tail.then(() => {
		if (tails.get(path) === tail) tails.delete(path);
	});
	return run;
}
