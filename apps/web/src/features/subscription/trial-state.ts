import {
	TRIAL_DAYS,
	TRIAL_EXTENSION_GRACE_DAYS,
	TRIAL_EXTENSION_STATUSES,
	TRIAL_STATUSES,
	type TrialExtensionStatus,
	type TrialStatus,
} from "@localman/shared/constants";
import { isRecord } from "../../lib/json-guards";

export type { TrialStatus };
export type ExtensionStatus = TrialExtensionStatus;

export interface ExtensionRequest {
	status: ExtensionStatus;
	requestedAt: string;
	decidedAt: string | null;
}

/** `trial` of `GET /users/me`. */
export interface TrialInfo {
	status: TrialStatus;
	startedAt: string | null;
	/** End of the Saigon day the trial (or its last extension) ends. */
	endsAt: string | null;
	extensionRequest: ExtensionRequest | null;
}

export const AVAILABLE_TRIAL: TrialInfo = Object.freeze({
	status: "available",
	startedAt: null,
	endsAt: null,
	extensionRequest: null,
});

function isTrialStatus(value: unknown): value is TrialStatus {
	return TRIAL_STATUSES.some((status) => status === value);
}

function isExtensionStatus(value: unknown): value is ExtensionStatus {
	return TRIAL_EXTENSION_STATUSES.some((status) => status === value);
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" ? value : null;
}

function parseExtensionRequest(value: unknown): ExtensionRequest | null {
	if (!isRecord(value) || !isExtensionStatus(value.status)) return null;
	const requestedAt = stringOrNull(value.requestedAt);
	if (requestedAt === null) return null;
	return {
		status: value.status,
		requestedAt,
		decidedAt: stringOrNull(value.decidedAt),
	};
}

/**
 * Tolerant on purpose: an API that does not send `trial` yet (or sends an
 * unknown shape) must not break the session, so anything unreadable is a
 * trial that is still available.
 */
export function parseTrial(value: unknown): TrialInfo {
	if (!isRecord(value) || !isTrialStatus(value.status)) return AVAILABLE_TRIAL;
	return {
		status: value.status,
		startedAt: stringOrNull(value.startedAt),
		endsAt: stringOrNull(value.endsAt),
		extensionRequest: parseExtensionRequest(value.extensionRequest),
	};
}

const DAY_MS = 86_400_000;
/** Asia/Saigon is UTC+7 all year (no daylight saving). */
const SAIGON_OFFSET_MS = 7 * 3_600_000;

function saigonDayNumber(ms: number): number {
	return Math.floor((ms + SAIGON_OFFSET_MS) / DAY_MS);
}

/**
 * Whole Saigon days left until `endsAt`: 0 on the last day, null when the
 * date is unreadable. The end is read 1 ms early so an exclusive midnight
 * (`00:00` of the next day) and an inclusive `23:59:59.999` give the same day.
 */
export function trialDaysLeft(
	endsAt: string | null,
	now: number = Date.now(),
): number | null {
	if (endsAt === null) return null;
	const end = Date.parse(endsAt);
	if (Number.isNaN(end)) return null;
	return Math.max(0, saigonDayNumber(end - 1) - saigonDayNumber(now));
}

/**
 * Whether the user may ask for an extension now: during the trial or up to
 * `TRIAL_EXTENSION_GRACE_DAYS` after it, with no request already waiting. The
 * server decides for good (409 `TRIAL_NOT_EXTENDABLE`).
 */
export function canRequestExtension(
	trial: TrialInfo,
	now: number = Date.now(),
): boolean {
	if (trial.extensionRequest?.status === "pending") return false;
	if (trial.status === "active") return true;
	if (trial.status !== "ended" || trial.endsAt === null) return false;
	const end = Date.parse(trial.endsAt);
	return !Number.isNaN(end) && now <= end + TRIAL_EXTENSION_GRACE_DAYS * DAY_MS;
}

/** What the Pro offer looks like to someone, from their session. */
export type TrialView = "guest" | "available" | "active" | "used" | "pro";

export interface TrialViewer {
	plan: "free" | "pro";
	trial: TrialInfo;
}

/**
 * `guest` for a visitor (and while the session is unknown, as prerendered);
 * a Pro plan without a running trial was granted by the owner (`pro`).
 */
export function trialView(user: TrialViewer | null): TrialView {
	if (user === null) return "guest";
	if (user.plan === "pro") {
		return user.trial.status === "active" ? "active" : "pro";
	}
	return user.trial.status === "available" ? "available" : "used";
}

/**
 * Noon (Asia/Saigon) of the day a trial started now would end, for the
 * confirmation; noon keeps the day the same in any display timezone.
 */
export function trialEndPreview(now: number = Date.now()): string {
	const endDay = saigonDayNumber(now) + TRIAL_DAYS;
	const date = new Date(endDay * DAY_MS).toISOString().slice(0, 10);
	return `${date}T12:00:00+07:00`;
}
