/**
 * The Pro trial (no billing yet): any account may start it once and is
 * Pro until the end of the Asia/Saigon day `TRIAL_DAYS` days later. The
 * owner may extend it, on request or directly.
 */
export const TRIAL_DAYS = 30;

/** Days an approved extension adds to the later of now and the current end. */
export const TRIAL_EXTENSION_DAYS = 30;

/** An extension may still be asked for this many days after the trial ended. */
export const TRIAL_EXTENSION_GRACE_DAYS = 7;

/** Length of the reason a user gives for an extension (after trimming). */
export const TRIAL_EXTENSION_REASON_MAX = 500;

/** Bounds of a direct extension by the owner, in days. */
export const TRIAL_DIRECT_EXTENSION_MAX_DAYS = 90;

/** `available`: never started; `active`: Pro now; `ended`: back to Free. */
export const TRIAL_STATUSES = ["available", "active", "ended"] as const;
export type TrialStatus = (typeof TRIAL_STATUSES)[number];

export const TRIAL_EXTENSION_STATUSES = [
	"pending",
	"approved",
	"declined",
] as const;
export type TrialExtensionStatus = (typeof TRIAL_EXTENSION_STATUSES)[number];
