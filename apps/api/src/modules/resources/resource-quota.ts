import { OperationError } from "@localman/operations";
import type { ClientSession, Types } from "mongoose";
import { duplicateKeyFields } from "../../db/mongo-errors.js";
import { assertResourceQuota, currentPlanOf } from "../billing/plan-guard.js";
import { MAX_QUOTA_ATTEMPTS, lowestFreeSlots } from "../billing/quota-slots.js";
import { inProjectTransaction } from "../projects/project-lock.js";
import { ResourceModel } from "./resource-model.js";

/**
 * Runs `work` in a transaction of `projectId` with `adding` free resource
 * slots of `ownerSub`, after checking the owner's plan (every resource of
 * every project they own counts). Creates in other projects of the same
 * owner do not share the project lock; they race on the unique
 * `(ownerSub, quotaSlot)` index instead, and the loser re-reads, re-checks
 * and retries here.
 */
export async function withResourceSlots<T>(
	ownerSub: string,
	projectId: Types.ObjectId,
	adding: number,
	work: (slots: number[], session: ClientSession) => Promise<T>,
): Promise<T> {
	const plan = await currentPlanOf(ownerSub);
	for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
		try {
			return await inProjectTransaction(projectId, async (session) => {
				const owned = await ResourceModel.find({ ownerSub })
					.select("quotaSlot")
					.session(session)
					.lean<{ quotaSlot: number }[]>();
				assertResourceQuota(plan, owned.length, adding);
				const taken = owned.map((resource) => resource.quotaSlot);
				return work(lowestFreeSlots(taken, adding), session);
			});
		} catch (error) {
			if (!duplicateKeyFields(error).includes("quotaSlot")) throw error;
		}
	}
	throw new OperationError(
		409,
		"CONFLICT",
		"Too many resources are being created at once; try again",
	);
}
