/**
 * Number and date formatting in the language on screen, for code that has
 * no `useI18n()` at hand. Components should prefer `useI18n().formatNumber`
 * / `formatDate`; these delegate to the same translator (dates in
 * Asia/Saigon whatever the browser's own zone is).
 */
import { activeTranslator } from "../i18n/active-translator";

export { APP_TIME_ZONE } from "../i18n/translate";

export function formatNumber(value: number): string {
	return activeTranslator().formatNumber(value);
}

/** Date in Asia/Saigon in the current language, or "" when unparsable. */
export function formatDate(iso: string): string {
	return activeTranslator().formatDate(iso);
}

/**
 * First day of the month after a `YYYY-MM` period, formatted like
 * `formatDate`, or "" for a malformed period.
 */
export function nextPeriodStart(period: string): string {
	const match = /^(\d{4})-(\d{2})$/.exec(period);
	if (!match) return "";
	const year = Number(match[1]);
	const month = Number(match[2]);
	const nextYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;
	// Midnight in Asia/Saigon (UTC+7, no daylight saving).
	const iso = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`;
	return formatDate(iso);
}
