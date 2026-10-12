import { OperationError } from "@localman/operations";
import { type PlanId, TRIAL_DAYS } from "@localman/shared";
import { type Logger, createLogger } from "../../logger.js";
import { effectivePlan } from "../billing/plan-guard.js";
import { signedOut } from "../users/me-view.js";
import { UserModel } from "../users/user-model.js";
import { saigonDayEndAfter } from "./trial-state.js";

let trialLogger: Logger = createLogger("silent");

/** Installed by `main.ts` with the app logger; silent until then. */
export function configureTrialLogger(logger: Logger): void {
	trialLogger = logger;
}

/** Structured log of trial decisions; never the user's reason. */
export function trialLog(): Logger {
	return trialLogger;
}

/** Concurrent extensions of one user re-read and retry this many times. */
const MAX_EXTEND_ATTEMPTS = 5;

interface StoredPlanFields {
	sub: string;
	plan: PlanId;
	planExpiresAt?: Date | null;
	trialStartedAt?: Date | null;
}

/**
 * Starts the account's one trial: Pro until the end of the Saigon day
 * `TRIAL_DAYS` days after `now`. The write only matches a user who never
 * started one, so two clicks at once start it once. Throws 409
 * `TRIAL_ALREADY_USED`, or `ALREADY_PRO` while an owner grant is in force.
 */
export async function startTrial(sub: string, now: Date): Promise<Date> {
	const user = await UserModel.findOne({ sub })
		.select("sub plan planExpiresAt trialStartedAt")
		.lean<StoredPlanFields>();
	if (!user) throw signedOut();
	const used = () =>
		new OperationError(
			409,
			"TRIAL_ALREADY_USED",
			"This account already used its Pro trial",
		);
	if (user.trialStartedAt) throw used();
	const stored = { plan: user.plan, planExpiresAt: user.planExpiresAt ?? null };
	if (effectivePlan(stored, now) === "pro") {
		throw new OperationError(
			409,
			"ALREADY_PRO",
			"This account is already on Pro",
		);
	}
	const endsAt = saigonDayEndAfter(now, TRIAL_DAYS);
	const { modifiedCount } = await UserModel.updateOne(
		{ sub, trialStartedAt: null },
		{ $set: { trialStartedAt: now, plan: "pro", planExpiresAt: endsAt } },
	);
	if (modifiedCount === 0) throw used();
	trialLog().info({ sub, endsAt }, "Pro trial started");
	return endsAt;
}

/**
 * Gives an account its 30 days of Pro without asking: once, and only when
 * it never had a trial and is not Pro already (an admin grant, or a Pro
 * that has not ended). One conditional write, so repeated or concurrent
 * calls start it at most once. `null` when nothing changed. Never throws:
 * a failed write must not fail the sign-in, and the next refresh retries.
 */
export async function autoStartTrial(
	sub: string,
	now = new Date(),
): Promise<Date | null> {
	const endsAt = saigonDayEndAfter(now, TRIAL_DAYS);
	let modifiedCount: number;
	try {
		({ modifiedCount } = await UserModel.updateOne(
			{
				sub,
				trialStartedAt: null,
				// Not Pro now: Free, or a Pro whose end has passed.
				$or: [{ plan: { $ne: "pro" } }, { planExpiresAt: { $lte: now } }],
			},
			{ $set: { trialStartedAt: now, plan: "pro", planExpiresAt: endsAt } },
		));
	} catch (error) {
		trialLog().warn({ err: error, sub }, "Automatic Pro period not started");
		return null;
	}
	if (modifiedCount === 0) return null;
	trialLog().info({ sub, endsAt }, "Pro period started automatically");
	return endsAt;
}

/**
 * Makes the user Pro until the end of the Saigon day `days` days after
 * the later of `now` and their current Pro end. Throws 404 `NOT_FOUND`
 * for an unknown user and 409 `PLAN_HAS_NO_EXPIRY` for a Pro without end
 * (an extension would shorten it). The write matches the plan it read, so
 * two extensions at once both count.
 */
export async function extendPro(
	sub: string,
	days: number,
	now: Date,
): Promise<Date> {
	for (let attempt = 0; attempt < MAX_EXTEND_ATTEMPTS; attempt += 1) {
		const user = await UserModel.findOne({ sub })
			.select("sub plan planExpiresAt")
			.lean<StoredPlanFields>();
		if (!user) throw new OperationError(404, "NOT_FOUND", "User not found");
		const current = user.planExpiresAt ?? null;
		if (user.plan === "pro" && current === null) {
			throw new OperationError(
				409,
				"PLAN_HAS_NO_EXPIRY",
				"This user's Pro has no end date; nothing to extend",
			);
		}
		const from =
			user.plan === "pro" && current !== null && current > now ? current : now;
		const endsAt = saigonDayEndAfter(from, days);
		const { modifiedCount } = await UserModel.updateOne(
			{ sub, plan: user.plan, planExpiresAt: current },
			{ $set: { plan: "pro", planExpiresAt: endsAt } },
		);
		if (modifiedCount === 1) return endsAt;
	}
	throw new OperationError(
		409,
		"CONFLICT",
		"The plan changed meanwhile; try again",
	);
}
