import { OperationError } from "@localman/operations";
import type { Types } from "mongoose";
import { type ForkKind, ForkModel } from "./fork-model.js";

/** Renames a fork's label (the caller already holds Editor on the fork). */
export async function relabelFork(
	kind: ForkKind,
	forkId: Types.ObjectId,
	label: string,
): Promise<void> {
	const updated = await ForkModel.updateOne(
		{ kind, forkId },
		{ $set: { label } },
	);
	if (updated.matchedCount === 0) {
		throw new OperationError(404, "FORK_NOT_FOUND", "This is not a fork");
	}
}
