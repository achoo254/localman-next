/**
 * History rows grouped by day in Asia/Saigon (the product's zone, whatever
 * the browser's is), newest first, plus the sidebar's search and method
 * filter. Pure, so day boundaries are tested without a clock.
 */
import type { HttpMethod } from "@localman/shared/api-client";
import { APP_TIME_ZONE } from "../../../i18n/translate";
import type { HistoryEntry } from "./history-api";

export type HistoryDayKind = "today" | "yesterday" | "date";

export interface HistoryDayGroup {
	/** `YYYY-MM-DD` in Asia/Saigon. */
	day: string;
	kind: HistoryDayKind;
	/** ISO time of the first entry, for formatting the date label. */
	firstAt: string;
	entries: HistoryEntry[];
}

/** `en-CA` formats dates as `YYYY-MM-DD`. */
const DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
	timeZone: APP_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day of `date` in Asia/Saigon; `""` for an invalid date. */
export function dayKey(date: Date): string {
	return Number.isNaN(date.getTime()) ? "" : DAY_FORMAT.format(date);
}

/** Groups in the order of `entries` (the API sends newest first). */
export function groupHistoryByDay(
	entries: readonly HistoryEntry[],
	now: Date,
): HistoryDayGroup[] {
	const today = dayKey(now);
	// Asia/Saigon has no daylight saving: a day is always 24 hours.
	const yesterday = dayKey(new Date(now.getTime() - DAY_MS));
	const groups: HistoryDayGroup[] = [];
	for (const entry of entries) {
		const day = dayKey(new Date(entry.createdAt));
		const last = groups[groups.length - 1];
		if (last && last.day === day) {
			last.entries.push(entry);
			continue;
		}
		const kind: HistoryDayKind =
			day === today ? "today" : day === yesterday ? "yesterday" : "date";
		groups.push({ day, kind, firstAt: entry.createdAt, entries: [entry] });
	}
	return groups;
}

export interface HistoryFilter {
	/** Matched in the URL and the name, case-insensitive. */
	query: string;
	method: HttpMethod | "ALL";
}

export function filterHistory(
	entries: readonly HistoryEntry[],
	{ query, method }: HistoryFilter,
): HistoryEntry[] {
	const needle = query.trim().toLowerCase();
	return entries.filter(
		(entry) =>
			(method === "ALL" || entry.method === method) &&
			(needle === "" ||
				entry.url.toLowerCase().includes(needle) ||
				entry.name.toLowerCase().includes(needle)),
	);
}
