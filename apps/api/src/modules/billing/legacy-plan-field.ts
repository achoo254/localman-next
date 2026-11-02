import { z } from "zod";

/**
 * There are no plans any more: every account has the same limits. Shipped
 * clients (the native app's bundled web build, cached PWAs) still refuse
 * `GET /users/me`, `GET /account/usage` and the traffic settings without
 * a `plan` of `free` or `pro`, so those answers keep the field, always
 * `pro`. New clients ignore it.
 */
export const LEGACY_PLAN = "pro" as const;

export const legacyPlanSchema = z
	.literal(LEGACY_PLAN)
	.describe(
		"Deprecated, always `pro`: every account has the same limits. Kept for older clients.",
	);
