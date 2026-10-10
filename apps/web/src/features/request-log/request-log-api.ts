import { apiRequest, withDryRun } from "../../lib/api-client";
import { apiUrl } from "../../lib/api-url";
import { expectNumber, expectRecord } from "../../lib/json-guards";
import {
	type LogLine,
	type LogPage,
	type ReplayResult,
	parseLine,
	parsePage,
	parseReplay,
} from "./request-log-parse";

const logsPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/request-logs`;

const linePath = (projectId: string, logId: string) =>
	`${logsPath(projectId)}/${encodeURIComponent(logId)}`;

export const requestLogKey = (projectId: string) =>
	["request-log", projectId] as const;

/** One page, newest first; `query` is `filterQuery(filters)`. */
export async function fetchLogPage(
	projectId: string,
	query: string,
	cursor: string | null,
): Promise<LogPage> {
	const params = new URLSearchParams(query);
	if (cursor) params.set("cursor", cursor);
	const search = params.toString();
	return parsePage(
		await apiRequest(`${logsPath(projectId)}${search ? `?${search}` : ""}`),
	);
}

export async function fetchLogLine(
	projectId: string,
	logId: string,
): Promise<LogLine> {
	return parseLine(await apiRequest(linePath(projectId, logId)));
}

/** Sends the logged request to the mock again (counts toward the quota). */
export async function replayLogLine(
	projectId: string,
	logId: string,
): Promise<ReplayResult> {
	return parseReplay(
		await apiRequest(`${linePath(projectId, logId)}/replay`, {
			method: "POST",
		}),
	);
}

/**
 * The logged request as an API client draft. Kept as an opaque JSON
 * object here: the API client checks it against the draft schema when it
 * opens the tab, so the project page does not load that schema.
 */
export async function fetchLogDraft(
	projectId: string,
	logId: string,
): Promise<object> {
	const data = expectRecord(
		await apiRequest(`${linePath(projectId, logId)}/draft`),
		"request log draft",
	);
	return expectRecord(data.draft, "draft");
}

/** Owner only. With `dryRun`, counts the lines instead of deleting them. */
export async function clearLog(
	projectId: string,
	dryRun: boolean,
): Promise<number> {
	const data = expectRecord(
		await apiRequest(withDryRun(logsPath(projectId), dryRun), {
			method: "DELETE",
		}),
		"clear request log",
	);
	return expectNumber(data, "deleted");
}

/** URL of the live stream (Server-Sent Events) with the same filters. */
export function logStreamUrl(projectId: string, query: string): string {
	return apiUrl(`${logsPath(projectId)}/stream${query ? `?${query}` : ""}`);
}
