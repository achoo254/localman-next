/** Asia/Saigon is UTC+7 all year (no daylight saving time). */
export const SAIGON_OFFSET_MS = 7 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, "0");

/** Calendar fields of an instant as seen in Asia/Saigon. */
function saigonFields(at: Date): { year: number; month: number; day: number } {
	const shifted = new Date(at.getTime() + SAIGON_OFFSET_MS);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	};
}

/** Billing month in Asia/Saigon, e.g. `2026-10`. */
export function saigonMonth(at: Date): string {
	const { year, month } = saigonFields(at);
	return `${year}-${pad(month)}`;
}

/** Calendar date in Asia/Saigon, e.g. `2026-10-09`. */
export function saigonDate(at: Date): string {
	const { year, month, day } = saigonFields(at);
	return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Last millisecond of a `YYYY-MM-DD` day in Asia/Saigon, or `null` when the
 * text is not a real calendar date.
 */
export function endOfSaigonDay(date: string): Date | null {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	const end = new Date(`${date}T23:59:59.999+07:00`);
	if (Number.isNaN(end.getTime()) || saigonDate(end) !== date) return null;
	return end;
}
