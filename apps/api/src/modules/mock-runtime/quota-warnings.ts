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

const formatCount = (value: number): string =>
	value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

/** In-app notification text of a warning (UI copy is Vietnamese). */
export function quotaWarningMessage(warning: QuotaWarning): {
	type: "usage.quota";
	title: string;
	body: string;
	link: string;
} {
	const used = thresholdCount(warning.limit, warning.threshold);
	const month = `${warning.month.slice(4)}/${warning.month.slice(0, 4)}`;
	const limit = formatCount(warning.limit);
	return {
		type: "usage.quota",
		title:
			warning.threshold >= 100
				? "Đã hết lượt gọi mock API tháng này"
				: `Đã dùng ${warning.threshold}% lượt gọi mock API tháng này`,
		body:
			warning.threshold >= 100
				? `Các project của bạn đã dùng hết ${limit} lượt gọi mock API của tháng ${month}. Mock API trả 429 cho tới đầu tháng sau hoặc khi bạn nâng cấp Pro.`
				: `Các project của bạn đã dùng ${formatCount(used)}/${limit} lượt gọi mock API của tháng ${month}.`,
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
