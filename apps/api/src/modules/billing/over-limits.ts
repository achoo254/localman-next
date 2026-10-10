import { type PlanId, limitsFor } from "@localman/shared";
import { z } from "zod";

/** Counted quotas a lapsed Pro can be over (creating is blocked there). */
export const OVER_LIMIT_KINDS = ["projects", "resources"] as const;

export const overLimitSchema = z.object({
	limit: z.enum(OVER_LIMIT_KINDS),
	used: z.number().int().min(0),
	max: z.number().int().min(0),
});

export type OverLimit = z.output<typeof overLimitSchema>;

/**
 * The limits of `plan` that `used` exceeds (strictly: at the limit is not
 * over). Happens after a Pro trial ends: nothing is deleted, but creating
 * more is refused until the count is back under the limit.
 */
export function overLimitsOf(
	plan: PlanId,
	used: Readonly<Record<(typeof OVER_LIMIT_KINDS)[number], number>>,
): OverLimit[] {
	const limits = limitsFor(plan);
	return OVER_LIMIT_KINDS.flatMap((limit) => {
		const max = limits[limit];
		return Number.isFinite(max) && used[limit] > max
			? [{ limit, used: used[limit], max }]
			: [];
	});
}
