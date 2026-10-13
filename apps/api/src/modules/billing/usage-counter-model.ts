import mongoose, { Schema } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { saigonMonth } from "../../time/saigon-time.js";

/** Monthly counters billed to the project owner. */
export const USAGE_COUNTERS = ["mockRequests", "proxyRequests"] as const;
export type UsageCounter = (typeof USAGE_COUNTERS)[number];

/**
 * One document per owner and month (Asia/Saigon calendar). Mock runtime
 * and proxy requests increment it; a missing document means zero use.
 */
const usageCounterSchema = new Schema(
	{
		ownerSub: { type: String, required: true },
		/** `YYYYMM`, e.g. `202610`. */
		yyyymm: { type: String, required: true, match: /^\d{6}$/ },
		mockRequests: { type: Number, required: true, default: 0 },
		proxyRequests: { type: Number, required: true, default: 0 },
	},
	{ collection: "usage_counters", timestamps: true, versionKey: false },
);
usageCounterSchema.index({ ownerSub: 1, yyyymm: 1 }, { unique: true });

usageCounterSchema.plugin(tenantScopePlugin);
export const UsageCounterModel = mongoose.model(
	"UsageCounter",
	usageCounterSchema,
);

/** `YYYYMM` key of the billing month containing `at`. */
export function yyyymmOf(at: Date): string {
	return saigonMonth(at).replace("-", "");
}

export type UsageTotals = Readonly<Record<UsageCounter, number>>;

/**
 * Atomically adds `by` to a counter of the owner's current month and
 * returns the new total, so the caller can compare it with the plan limit.
 */
export async function incrementUsage(
	ownerSub: string,
	counter: UsageCounter,
	by = 1,
	at: Date = new Date(),
): Promise<number> {
	const update = async () =>
		UsageCounterModel.findOneAndUpdate(
			{ ownerSub, yyyymm: yyyymmOf(at) },
			{ $inc: { [counter]: by } },
			{ upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
		).lean<UsageTotals>();
	let totals: UsageTotals | null;
	try {
		totals = await update();
	} catch (error) {
		// Two first increments of a month racing: the loser updates.
		if (!isDuplicateKeyError(error)) throw error;
		totals = await update();
	}
	return totals?.[counter] ?? 0;
}

/** Counters of the month containing `at`; zero when nothing was counted. */
export async function readUsage(
	ownerSub: string,
	at: Date = new Date(),
): Promise<UsageTotals> {
	const doc = await UsageCounterModel.findOne({
		ownerSub,
		yyyymm: yyyymmOf(at),
	}).lean<Partial<UsageTotals>>();
	return {
		mockRequests: doc?.mockRequests ?? 0,
		proxyRequests: doc?.proxyRequests ?? 0,
	};
}
