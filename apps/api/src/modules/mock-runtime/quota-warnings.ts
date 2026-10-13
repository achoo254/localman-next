import type { Logger } from "../../logger.js";
import type { NotificationService } from "../notifications/notification-service.js";

/** Shares of the monthly quota that send the owner a warning. */
export const QUOTA_THRESHOLDS = [80, 100] as const;
export type QuotaThreshold = (typeof QUOTA_THRESHOLDS)[number];

export interface QuotaWarning {
	readonly threshold: QuotaThreshold;
	readonly limit: number;
	/** `YYYYMM` of the counted month. */
	readonly month: string;
}

/** Request count at which `threshold` percent of `limit` is used. */
function thresholdCount(limit: number, threshold: QuotaThreshold): number {
	return Math.ceil((limit * threshold) / 100);
}

/**
 * Thresholds the counter passed when it moved from `before` to `after`
 * (`before < count <= after`); none without a monthly limit.
 */
export function crossedThresholds(
	limit: number | null,
	before: number,
	after: number,
): QuotaThreshold[] {
	if (limit === null || limit <= 0) return [];
	return QUOTA_THRESHOLDS.filter((threshold) => {
		const count = thresholdCount(limit, threshold);
		return before < count && count <= after;
	});
}

/**
 * Notification of a warning; its texts are rendered in the owner's
 * language (`src/i18n/messages/*`, `quota`).
 */
export function quotaWarningMessage(warning: QuotaWarning): {
	type: "usage.quota";
	params: { threshold: number; limit: number; used: number; month: string };
	link: string;
} {
	return {
		type: "usage.quota",
		params: {
			threshold: warning.threshold,
			limit: warning.limit,
			used: thresholdCount(warning.limit, warning.threshold),
			month: warning.month,
		},
		link: "/account",
	};
}

/** Sends warnings as notifications through the configured service. */
export function notifyQuotaWarning(
	service: () => NotificationService,
): (owner: string, warning: QuotaWarning) => Promise<void> {
	return async (owner, warning) => {
		await service().notify(owner, quotaWarningMessage(warning));
	};
}

/** One flush's move of a counter, from `before` to `after` requests. */
export interface CounterMove {
	readonly limit: number | null;
	/** `YYYYMM` of the counted month. */
	readonly month: string;
	readonly before: number;
	readonly after: number;
}

/**
 * Sends `owner` a warning for each threshold the move crossed; a failed
 * warning is logged and the others are still sent.
 */
export async function sendCrossedWarnings(
	sender: {
		readonly warn: (owner: string, warning: QuotaWarning) => Promise<void>;
		readonly logger: Logger;
	},
	owner: string,
	move: CounterMove,
): Promise<void> {
	for (const threshold of crossedThresholds(
		move.limit,
		move.before,
		move.after,
	)) {
		try {
			await sender.warn(owner, {
				threshold,
				limit: move.limit ?? 0,
				month: move.month,
			});
		} catch (error) {
			sender.logger.error({ err: error, threshold }, "Quota warning failed");
		}
	}
}
