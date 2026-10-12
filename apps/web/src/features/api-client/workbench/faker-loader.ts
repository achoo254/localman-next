/**
 * Faker for `{{$random…}}` in a send. Its chunk (the whitelisted runners
 * and Faker's English locale) is imported on the first send that uses
 * such a name, never with the app. Previews and code snippets render
 * synchronously without it and show those names as typed.
 */
import {
	type ApiRequestDraft,
	type FakerRunner,
	extractUsedVariables,
	needsFakerRunner,
} from "@localman/shared/api-client";

/** Whether the request uses a `$random…` name only Faker fills. */
export function needsFaker(draft: ApiRequestDraft): boolean {
	return extractUsedVariables(draft).some((name) => needsFakerRunner(name));
}

let loading: Promise<FakerRunner> | null = null;

/** Loads Faker once; rejects when its chunk cannot be fetched. */
export async function loadFakerRunner(): Promise<FakerRunner> {
	loading ??= import("@localman/shared/faker-methods").then(
		({ runFakerMethodText }) =>
			(id: string) =>
				runFakerMethodText(id),
	);
	try {
		return await loading;
	} catch (cause) {
		// A failed chunk fetch is not cached: the next send tries again.
		loading = null;
		throw cause;
	}
}

export type FakerForSend = { ok: true; runFaker?: FakerRunner } | { ok: false };

/** The runner this request needs (none when it uses no Faker name). */
export async function fakerForSend(
	draft: ApiRequestDraft,
): Promise<FakerForSend> {
	if (!needsFaker(draft)) return { ok: true };
	try {
		return { ok: true, runFaker: await loadFakerRunner() };
	} catch {
		return { ok: false };
	}
}
