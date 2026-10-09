/**
 * API client history on the server (`client_history`, own entries only):
 * list by cursor, read one, record, delete one, clear. Responses are
 * checked at this edge; the stored draft goes through the same schema the
 * server used when it was written.
 */
import {
	type ApiRequestDraft,
	HTTP_METHODS,
	type HttpMethod,
	apiRequestDraftSchema,
} from "@localman/shared/api-client";
import { apiRequest, withDryRun } from "../../../lib/api-client";
import {
	InvalidResponseError,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../../lib/json-guards";
import type { SendRoute } from "../workbench/workbench-types";

const HISTORY_PATH = "/api/v1/client/history";
export const HISTORY_PAGE_SIZE = 50;

/** How the server names a route (`tunnel` for a Tunelo send). */
type StoredRoute = "direct" | "proxy" | "tunnel";

export interface HistoryEntry {
	id: string;
	name: string;
	method: HttpMethod;
	/** As typed, `{{var}}` placeholders kept. */
	url: string;
	response: {
		status: number;
		ms: number;
		size: number;
		route: SendRoute;
		finalUrl: string | null;
	};
	bodyOmitted: boolean;
	createdAt: string;
}

export interface HistoryDetail extends HistoryEntry {
	/** The request as it was written, ready to open in a tab. */
	draft: ApiRequestDraft;
}

export interface HistoryPage {
	items: HistoryEntry[];
	nextCursor: string | null;
}

function parseRoute(value: string): SendRoute {
	if (value === "tunnel") return "tunelo";
	if (value === "direct" || value === "proxy") return value;
	throw new InvalidResponseError("history route");
}

function parseEntry(value: unknown): HistoryEntry {
	const data = expectRecord(value, "history entry");
	const response = expectRecord(data.response, "history response");
	const method = HTTP_METHODS.find((m) => m === data.method);
	if (!method) throw new InvalidResponseError("history method");
	return {
		id: expectString(data, "id"),
		name: expectString(data, "name"),
		method,
		url: expectString(data, "url"),
		response: {
			status: expectNumber(response, "status"),
			ms: expectNumber(response, "ms"),
			size: expectNumber(response, "size"),
			route: parseRoute(expectString(response, "route")),
			finalUrl: optionalString(response, "finalUrl"),
		},
		bodyOmitted: expectBoolean(data, "bodyOmitted"),
		createdAt: expectString(data, "createdAt"),
	};
}

export async function fetchHistoryPage(
	cursor: string | null,
): Promise<HistoryPage> {
	const query = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
	if (cursor) query.set("cursor", cursor);
	const data = expectRecord(
		await apiRequest(`${HISTORY_PATH}?${query}`),
		"history page",
	);
	return {
		items: expectArray(data, "items").map(parseEntry),
		nextCursor: optionalString(data, "nextCursor"),
	};
}

export async function fetchHistoryEntry(id: string): Promise<HistoryDetail> {
	const data = expectRecord(
		await apiRequest(`${HISTORY_PATH}/${encodeURIComponent(id)}`),
		"history detail",
	);
	const draft = apiRequestDraftSchema.safeParse(data.draft);
	if (!draft.success) throw new InvalidResponseError("history draft");
	return { ...parseEntry(data), draft: draft.data };
}

/** What the browser measured of a response it got. */
export interface HistoryResponseSummary {
	status: number;
	ms: number;
	size: number;
	route: SendRoute;
	finalUrl?: string;
}

/**
 * Records a send. `draft` must be the tab as written (never with variables
 * filled in): the server would otherwise see secret values.
 */
export async function recordHistoryEntry(
	draft: ApiRequestDraft,
	response: HistoryResponseSummary,
): Promise<HistoryEntry> {
	const route: StoredRoute =
		response.route === "tunelo" ? "tunnel" : response.route;
	return parseEntry(
		await apiRequest(HISTORY_PATH, {
			method: "POST",
			body: { draft, response: { ...response, route } },
		}),
	);
}

export async function deleteHistoryEntry(id: string): Promise<void> {
	await apiRequest(`${HISTORY_PATH}/${encodeURIComponent(id)}`, {
		method: "DELETE",
	});
}

/** Deletes every entry; with `dryRun`, only counts them. */
export async function clearHistory(dryRun: boolean): Promise<number> {
	const data = expectRecord(
		await apiRequest(withDryRun(HISTORY_PATH, dryRun), { method: "DELETE" }),
		"history clear",
	);
	return expectNumber(data, "entryCount");
}
