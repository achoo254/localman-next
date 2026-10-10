import {
	OutboundJobModel,
	type StoredOutboundJob,
} from "./outbound-job-model.js";

/**
 * Deliveries (callbacks and inbox forwards together) one owner may have
 * waiting; past it new ones are refused, so one account's dead target
 * cannot fill the queue that everyone shares.
 */
export const MAX_PENDING_PER_OWNER = 200;

/** Enqueues of one owner in this process, run one after the other. */
const chains = new Map<string, Promise<void>>();

function oneAtATime<T>(owner: string, work: () => Promise<T>): Promise<T> {
	const previous = chains.get(owner) ?? Promise.resolve();
	const run = previous.then(work);
	const tail = run.then(
		() => undefined,
		() => undefined,
	);
	chains.set(owner, tail);
	void tail.then(() => {
		if (chains.get(owner) === tail) chains.delete(owner);
	});
	return run;
}

export interface EnqueueResult {
	readonly accepted: readonly StoredOutboundJob[];
	/** Past the owner's cap: not queued, to be settled as `queue_full`. */
	readonly rejected: readonly StoredOutboundJob[];
}

/**
 * Queues the jobs of `owner` that fit under `MAX_PENDING_PER_OWNER`, in
 * order; the rest are returned as rejected. Count and insert run one
 * enqueue at a time per owner, so concurrent writes cannot pass the cap
 * together (one process serves the API).
 */
export function enqueueJobs(
	owner: string,
	jobs: readonly StoredOutboundJob[],
	max: number = MAX_PENDING_PER_OWNER,
): Promise<EnqueueResult> {
	return oneAtATime(owner, async () => {
		const pending = await OutboundJobModel.countDocuments(
			{ owner },
			{ limit: max },
		);
		const room = Math.max(0, max - pending);
		const accepted = jobs.slice(0, room);
		if (accepted.length > 0) await OutboundJobModel.insertMany(accepted);
		return { accepted, rejected: jobs.slice(room) };
	});
}
