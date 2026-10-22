import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { mobileAuthHeaders } from "../../platform/native/mobile-session";
import { isNativeBuild } from "../../platform/native/native-build";
import { openEventStream } from "../../platform/native/native-event-stream";
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
		if (!enabled) return;
		if (!isNativeBuild && typeof EventSource === "undefined") return;
		const key = `${projectId}?${query}`;
		let close: (() => void) | null = null;
		let retryTimer: number | undefined;
		let failures = 0;
		const opened = () => {
			failures = 0;
			setDown(false);
			if (openedFor.current === key) handlers.current.onResume();
			openedFor.current = key;
		};
		const received = (data: unknown) => {
			const line = typeof data === "string" ? parseLogEvent(data) : null;
			if (line) handlers.current.onLine(line);
		};
		const retryLater = () => {
			const delay =
				STREAM_RETRY_MS[Math.min(failures, STREAM_RETRY_MS.length - 1)];
			failures += 1;
			retryTimer = window.setTimeout(connect, delay);
		};
		// The iOS/Android shell signs requests with a Bearer token, which
		// EventSource cannot send: it reads the same stream over fetch.
		const connectNative = () =>
			openEventStream(logStreamUrl(projectId, query), mobileAuthHeaders(), {
				onOpen: opened,
				onEvent: (event, data) => {
					if (event === "log") received(data);
				},
				onClose: () => {
					setDown(true);
					retryLater();
				},
			});
		const connectBrowser = () => {
			const current = new EventSource(logStreamUrl(projectId, query), {
				withCredentials: true,
			});
			current.onopen = opened;
			current.addEventListener("log", (event) => {
				if (event instanceof MessageEvent) received(event.data);
			});
			current.onerror = () => {
				setDown(true);
				if (current.readyState !== EventSource.CLOSED) return;
				current.close();
				retryLater();
			};
			return () => current.close();
		};
		function connect() {
			close = isNativeBuild ? connectNative() : connectBrowser();
		}
		connect();
		return () => {
			window.clearTimeout(retryTimer);
			close?.();
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
