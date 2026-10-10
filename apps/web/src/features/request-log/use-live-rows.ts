import { useCallback, useEffect, useRef, useState } from "react";
import type { LogSummary } from "./request-log-parse";

/** Live rows kept in memory, newest first. */
export const MAX_LIVE_ROWS = 200;
/** How long a new row stays highlighted. */
export const FLASH_MS = 1200;
/** Screen readers hear "N new requests" every 5 rows or 10 seconds at most. */
export const ANNOUNCE_EVERY = 5;
export const ANNOUNCE_AFTER_MS = 10_000;

export interface Announcement {
	count: number;
	/** Changes with each announcement, so the same count is read again. */
	seq: number;
}

export interface LiveRows {
	rows: LogSummary[];
	/** Ids of rows that arrived less than `FLASH_MS` ago. */
	fresh: ReadonlySet<string>;
	announcement: Announcement | null;
	/**
	 * Adds a streamed row; one already shown (`known`, or a live row with
	 * the same id: an amended line) is replaced in place, unflashed and
	 * unannounced.
	 */
	push: (line: LogSummary, known?: boolean) => void;
	clear: () => void;
}

/**
 * Rows received over the live stream for one filter `key`; a new key
 * starts empty (the list query of that filter brings the history).
 */
export function useLiveRows(key: string): LiveRows {
	const [state, setState] = useState<{ key: string; rows: LogSummary[] }>({
		key,
		rows: [],
	});
	// The rows as last set, read synchronously by `push` (state may lag).
	const latest = useRef(state);
	const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
	const [announcement, setAnnouncement] = useState<Announcement | null>(null);
	const pending = useRef(0);
	const announceTimer = useRef<number | undefined>(undefined);

	const flush = useCallback(() => {
		window.clearTimeout(announceTimer.current);
		announceTimer.current = undefined;
		const count = pending.current;
		pending.current = 0;
		if (count > 0) {
			setAnnouncement((previous) => ({
				count,
				seq: (previous?.seq ?? 0) + 1,
			}));
		}
	}, []);

	useEffect(() => () => window.clearTimeout(announceTimer.current), []);

	const push = useCallback(
		(line: LogSummary, known = false) => {
			const rows = latest.current.key === key ? latest.current.rows : [];
			const at = rows.findIndex((row) => row.id === line.id);
			const next =
				at === -1
					? [line, ...rows].slice(0, MAX_LIVE_ROWS)
					: rows.map((row, i) => (i === at ? line : row));
			latest.current = { key, rows: next };
			setState(latest.current);
			if (at !== -1 || known) return;
			setFresh((previous) => new Set(previous).add(line.id));
			window.setTimeout(() => {
				setFresh((previous) => {
					const next = new Set(previous);
					next.delete(line.id);
					return next;
				});
			}, FLASH_MS);
			pending.current += 1;
			if (pending.current >= ANNOUNCE_EVERY) flush();
			else if (announceTimer.current === undefined) {
				announceTimer.current = window.setTimeout(flush, ANNOUNCE_AFTER_MS);
			}
		},
		[key, flush],
	);

	const clear = useCallback(() => {
		latest.current = { key, rows: [] };
		setState(latest.current);
	}, [key]);

	return {
		rows: state.key === key ? state.rows : [],
		fresh,
		announcement,
		push,
		clear,
	};
}

/** Live and listed rows without duplicates, newest first. */
export function mergeRows(
	live: readonly LogSummary[],
	listed: readonly LogSummary[],
): LogSummary[] {
	const seen = new Set<string>();
	const rows: LogSummary[] = [];
	for (const row of [...live, ...listed]) {
		if (seen.has(row.id)) continue;
		seen.add(row.id);
		rows.push(row);
	}
	return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
