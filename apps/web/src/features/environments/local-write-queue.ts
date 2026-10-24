/**
 * The local values of one scope are written one at a time, in the order
 * they were asked for (the table's autosave, scripts, "Let agents use",
 * moving old values into the vault), so a write worked out from older
 * data never lands after a newer one. While writes follow each other,
 * `latestAnswer` is what the last one got back from the server: a write
 * built at its turn starts from there instead of a cache not updated yet.
 */
import type { LocalValue } from "@localman/shared/api-client";

const tails = new Map<string, Promise<void>>();
const answers = new Map<string, LocalValue[]>();

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
		if (tails.get(path) !== tail) return;
		tails.delete(path);
		answers.delete(path);
	});
	return run;
}

export function rememberAnswer(path: string, values: LocalValue[]): void {
	answers.set(path, values);
}

/** The last answer of the writes still running for `path`, if any. */
export function latestAnswer(path: string): LocalValue[] | undefined {
	return answers.get(path);
}
