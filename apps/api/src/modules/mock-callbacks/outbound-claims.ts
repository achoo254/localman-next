import { acrossTenants } from "../../tenancy/tenant-context.js";
import {
	OutboundJobModel,
	type StoredOutboundJob,
} from "./outbound-job-model.js";

/** An owner whose deliveries in flight reached the per-owner cap. */
export interface BusyOwner {
	readonly tenantId: string;
	readonly owner: string;
}

/**
 * Takes (deletes) one job past its deadline that no worker holds, of any
 * tenant (the queue serves them all).
 */
export function takeExpiredJob(): Promise<StoredOutboundJob | null> {
	const now = new Date();
	return acrossTenants(() =>
		OutboundJobModel.findOneAndDelete({
			deadlineAt: { $lte: now },
			$or: [{ state: "pending" }, { lockedUntil: { $lte: now } }],
		})
			.lean<StoredOutboundJob>()
			.exec(),
	);
}

/**
 * Locks the next due job of any tenant until `lockedUntil`, skipping the
 * busy owners; a `running` job whose lock expired is due again.
 */
export function claimDueJob(
	busy: readonly BusyOwner[],
	lockedUntil: Date,
): Promise<StoredOutboundJob | null> {
	const now = new Date();
	return acrossTenants(() =>
		OutboundJobModel.findOneAndUpdate(
			{
				$or: [
					{ state: "pending", nextAt: { $lte: now } },
					{ state: "running", lockedUntil: { $lte: now } },
				],
				deadlineAt: { $gt: now },
				...(busy.length > 0 ? { $nor: [...busy] } : {}),
			},
			{ $set: { state: "running", lockedUntil } },
			{ sort: { nextAt: 1 }, returnDocument: "after" },
		)
			.lean<StoredOutboundJob>()
			.exec(),
	);
}

/** Deliveries in flight per owner (owners are per tenant). */
export class OwnerSlots {
	private readonly held = new Map<string, BusyOwner & { count: number }>();

	/** Holds a slot of the owner; returns its release. */
	take(owner: BusyOwner): () => void {
		const key = `${owner.tenantId}\n${owner.owner}`;
		const slot = this.held.get(key) ?? { ...owner, count: 0 };
		slot.count += 1;
		this.held.set(key, slot);
		return () => {
			slot.count -= 1;
			if (slot.count <= 0) this.held.delete(key);
		};
	}

	/** Owners holding `perOwner` slots or more. */
	busy(perOwner: number): BusyOwner[] {
		return [...this.held.values()]
			.filter(({ count }) => count >= perOwner)
			.map(({ tenantId, owner }) => ({ tenantId, owner }));
	}
}
