/**
 * Display formatting for numbers and dates. Dates are shown in the product's
 * timezone (Asia/Saigon) whatever the browser's own zone is.
 */

export const APP_TIME_ZONE = "Asia/Saigon";

const NUMBER_FORMAT = new Intl.NumberFormat("vi-VN");

const DATE_FORMAT = new Intl.DateTimeFormat("vi-VN", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
	timeZone: APP_TIME_ZONE,
});

export function formatNumber(value: number): string {
	return NUMBER_FORMAT.format(value);
}

/** `dd/mm/yyyy` in Asia/Saigon, or "" for an unparsable value. */
export function formatDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : DATE_FORMAT.format(date);
}

/** First day of the month after a `YYYY-MM` period, as `01/mm/yyyy`. */
export function nextPeriodStart(period: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(period);
	if (!match) return "";
	const year = Number(match[1]);
	const month = Number(match[2]);
	const nextYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;
	return `01/${String(nextMonth).padStart(2, "0")}/${nextYear}`;
}
