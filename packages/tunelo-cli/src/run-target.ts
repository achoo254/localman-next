import type { RunRecord } from "./run-registry.js";

/**
 * Running tunnels a `kill`/`watch` target names: a PID, or text found in
 * one of its tunnel URLs (a subdomain or the whole URL).
 */
export function matchRuns(
	records: readonly RunRecord[],
	target: string,
): RunRecord[] {
	return records.filter(
		(record) =>
			String(record.pid) === target ||
			record.tunnels.some((tunnel) => tunnel.url.includes(target)),
	);
}

/** The subdomain of the tunnel of `record` whose URL `target` names, if any. */
export function targetSubdomain(
	record: RunRecord,
	target: string,
): string | undefined {
	if (String(record.pid) === target) return undefined;
	const tunnel = record.tunnels.find((item) => item.url.includes(target));
	if (!tunnel) return undefined;
	try {
		return new URL(tunnel.url).hostname.split(".")[0];
	} catch {
		return undefined;
	}
}
