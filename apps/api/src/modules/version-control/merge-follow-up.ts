import type { MergeOption } from "@localman/shared/api-client";

/**
 * What became of the step after a merge: `none` for a plain merge, `done`,
 * or `failed` when the fork could not be updated or deleted after the
 * merge was written (a pull then meets conflicts made meanwhile): the
 * merge stands, and the caller pulls or deletes by hand.
 */
export type MergeFollowUp = "none" | "done" | "failed";

export async function followUp(
	option: MergeOption,
	step: () => Promise<void>,
): Promise<MergeFollowUp> {
	if (option === "merge") return "none";
	try {
		await step();
		return "done";
	} catch {
		return "failed";
	}
}
