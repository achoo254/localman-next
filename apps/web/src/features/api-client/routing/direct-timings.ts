/**
 * Timings of a direct send from the Resource Timing entry of its URL. A
 * cross-origin target that does not send `Timing-Allow-Origin` hides the
 * phases (they read as 0), so only the total measured here is certain.
 */
import type { ResponseTimings } from "@localman/shared/api-client";

function lastEntry(url: string): PerformanceResourceTiming | null {
	if (typeof performance.getEntriesByName !== "function") return null;
	const entries = performance.getEntriesByName(url, "resource");
	const last = entries[entries.length - 1];
	return last instanceof PerformanceResourceTiming ? last : null;
}

/** `end - start` when both were exposed (non-zero), else `null`. */
function phase(start: number, end: number): number | null {
	return start > 0 && end >= start ? end - start : null;
}

export function readTimings(
	url: string,
	started: number,
	ended: number,
): ResponseTimings {
	const total = Math.max(0, ended - started);
	const entry =
		typeof PerformanceResourceTiming === "undefined" ? null : lastEntry(url);
	if (!entry) return { dns: null, connect: null, tls: null, ttfb: null, total };
	const tlsEnd = entry.secureConnectionStart > 0 ? entry.connectEnd : 0;
	return {
		dns: phase(entry.domainLookupStart, entry.domainLookupEnd),
		connect: phase(entry.connectStart, entry.connectEnd),
		tls: phase(entry.secureConnectionStart, tlsEnd),
		ttfb: phase(entry.startTime, entry.responseStart),
		total,
	};
}
