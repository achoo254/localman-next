import { vi } from "vitest";
import { makeUser } from "../../test/fixtures";
import type { CurrentUser } from "../auth/current-user";
import type { TrialInfo } from "./trial-state";

/** 10:00 on Oct 10, 2026 in Saigon: "today" of the trial tests. */
export const TRIAL_NOW = new Date("2026-10-10T10:00:00+07:00");
/** Twelve Saigon days after `TRIAL_NOW`. */
export const ENDS_IN_12_DAYS = "2026-10-22T16:59:59.999Z";

/** Fakes only `Date`, so user-event and timers keep running. */
export function freezeTrialClock(): void {
	vi.useFakeTimers({ now: TRIAL_NOW, toFake: ["Date"] });
}

export type TrialCase = "available" | "active" | "used" | "usedLong" | "pro";

const TRIALS: Record<TrialCase, { plan: "free" | "pro"; trial: TrialInfo }> = {
	available: {
		plan: "free",
		trial: {
			status: "available",
			startedAt: null,
			endsAt: null,
			extensionRequest: null,
		},
	},
	active: {
		plan: "pro",
		trial: {
			status: "active",
			startedAt: "2026-09-22T03:00:00.000Z",
			endsAt: ENDS_IN_12_DAYS,
			extensionRequest: null,
		},
	},
	/** Ended three days ago: an extension can still be asked for. */
	used: {
		plan: "free",
		trial: {
			status: "ended",
			startedAt: "2026-09-07T03:00:00.000Z",
			endsAt: "2026-10-07T16:59:59.999Z",
			extensionRequest: null,
		},
	},
	/** Ended a month ago: past the request window. */
	usedLong: {
		plan: "free",
		trial: {
			status: "ended",
			startedAt: "2026-08-10T03:00:00.000Z",
			endsAt: "2026-09-09T16:59:59.999Z",
			extensionRequest: null,
		},
	},
	/** Pro granted by the owner, never on trial. */
	pro: {
		plan: "pro",
		trial: {
			status: "available",
			startedAt: null,
			endsAt: null,
			extensionRequest: null,
		},
	},
};

export function trialUser(
	kind: TrialCase,
	overrides: Partial<CurrentUser> = {},
): CurrentUser {
	return makeUser({ ...TRIALS[kind], ...overrides });
}
