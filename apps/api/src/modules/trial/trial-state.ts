import {
	type PlanId,
	TRIAL_EXTENSION_GRACE_DAYS,
	type TrialStatus,
} from "@localman/shared";
import { endOfSaigonDay, saigonDate } from "../../time/saigon-time.js";
import { effectivePlan } from "../billing/plan-guard.js";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The plan and trial fields of a stored user. */
export interface TrialUser {
	readonly plan: PlanId;
	readonly planExpiresAt: Date | null;
	readonly trialStartedAt: Date | null;
}

export interface TrialState {
	readonly status: TrialStatus;
	readonly startedAt: Date | null;
	/** `planExpiresAt` once a trial was started (extensions move it). */
	readonly endsAt: Date | null;
}

/**
 * Where the user's trial stands. Only `trialStartedAt` decides whether
 * the trial was used: a user the owner made Pro without a trial can
 * still start one once the grant lapses.
 */
export function trialStateOf(user: TrialUser, now: Date): TrialState {
	if (user.trialStartedAt === null) {
		return { status: "available", startedAt: null, endsAt: null };
	}
	const pro = effectivePlan(user, now) === "pro";
	return {
		status: pro ? "active" : "ended",
		startedAt: user.trialStartedAt,
		endsAt: user.planExpiresAt,
	};
}

/**
 * Whether the user may ask for an extension: the trial runs, or it ended
 * at most `TRIAL_EXTENSION_GRACE_DAYS` ago.
 */
export function canRequestExtension(state: TrialState, now: Date): boolean {
	if (state.status === "active") return true;
	if (state.status !== "ended" || state.endsAt === null) return false;
	return (
		now.getTime() - state.endsAt.getTime() <=
		TRIAL_EXTENSION_GRACE_DAYS * DAY_MS
	);
}

/** The last millisecond of the Asia/Saigon day `days` days after `from`. */
export function saigonDayEndAfter(from: Date, days: number): Date {
	const end = endOfSaigonDay(
		saigonDate(new Date(from.getTime() + days * DAY_MS)),
	);
	// `saigonDate` always yields a real calendar date.
	if (end === null) throw new Error("Invalid Saigon date");
	return end;
}
