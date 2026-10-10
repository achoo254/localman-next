import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { logStreamUrl } from "./request-log-api";
import { type LogSummary, parseLogEvent } from "./request-log-parse";

export type LiveState = "live" | "paused" | "reconnecting";

/**
 * Waits before opening again a stream the browser gave up on (the server
 * refused it: too many streams, signed out). Dropped connections are
 * retried by the browser itself, after the server's `retry: 5000`.
 */
export const STREAM_RETRY_MS: readonly number[] = [5_000, 15_000, 30_000];

export interface LogStreamOptions {
	projectId: string;
	/** `filterQuery(filters)`: the stream filters like the list. */
	query: string;
	/** Live switched on and the page visible. */
	enabled: boolean;
	onLine: (line: LogSummary) => void;
	/** Opened again after a gap (error, pause, hidden page): rows may be missing. */
	onResume: () => void;
}

/**
 * One `EventSource` on the project's live log while `enabled`; closed
 * when disabled or unmounted. Keeps retrying while the connection is lost.
 */
export function useLogStream({
	projectId,
	query,
	enabled,
	onLine,
	onResume,
}: LogStreamOptions): LiveState {
	const [down, setDown] = useState(false);
	const handlers = useRef({ onLine, onResume });
	handlers.current = { onLine, onResume };
	// Stream last opened, to tell a resume from a new filter.
	const openedFor = useRef<string | null>(null);

	useEffect(() => {
		if (!enabled || typeof EventSource === "undefined") return;
		const key = `${projectId}?${query}`;
		let source: EventSource | null = null;
		let retryTimer: number | undefined;
		let failures = 0;
		const connect = () => {
			const current = new EventSource(logStreamUrl(projectId, query), {
				withCredentials: true,
			});
			source = current;
			current.onopen = () => {
				failures = 0;
				setDown(false);
				if (openedFor.current === key) handlers.current.onResume();
				openedFor.current = key;
			};
			current.addEventListener("log", (event) => {
				if (!(event instanceof MessageEvent)) return;
				const data: unknown = event.data;
				const line = typeof data === "string" ? parseLogEvent(data) : null;
				if (line) handlers.current.onLine(line);
			});
			current.onerror = () => {
				setDown(true);
				if (current.readyState !== EventSource.CLOSED) return;
				current.close();
				const delay =
					STREAM_RETRY_MS[Math.min(failures, STREAM_RETRY_MS.length - 1)];
				failures += 1;
				retryTimer = window.setTimeout(connect, delay);
			};
		};
		connect();
		return () => {
			window.clearTimeout(retryTimer);
			source?.close();
			setDown(false);
		};
	}, [enabled, projectId, query]);

	if (!enabled) return "paused";
	return down ? "reconnecting" : "live";
}

function subscribeVisibility(onChange: () => void): () => void {
	document.addEventListener("visibilitychange", onChange);
	return () => document.removeEventListener("visibilitychange", onChange);
}

/** False while the page is hidden (another browser tab, minimised). */
export function usePageVisible(): boolean {
	return useSyncExternalStore(
		subscribeVisibility,
		() => document.visibilityState !== "hidden",
		() => true,
	);
}
