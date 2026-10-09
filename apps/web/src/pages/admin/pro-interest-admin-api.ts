import { ApiError, apiRequest } from "../../lib/api-client";
import {
	type JsonRecord,
	expectArray,
	expectNumber,
	expectRecord,
	expectString,
} from "../../lib/json-guards";

import { type ProInterestItem, parseItem } from "./pro-interest-item";

export type { ProInterestItem };

const BASE = "/api/v1/admin/pro-interest";

export interface CountBy {
	key: string;
	count: number;
}

export interface ProInterestStats {
	total: number;
	new7d: number;
	new30d: number;
	bySource: CountBy[];
	byNeed: CountBy[];
}

export interface ProInterestPage {
	items: ProInterestItem[];
	total: number;
	page: number;
	pageSize: number;
}

export interface ProInterestFilter {
	source: string;
	need: string;
	/** "" for all, otherwise "true" / "false". */
	contacted: "" | "true" | "false";
	q: string;
}

export const EMPTY_FILTER: ProInterestFilter = {
	source: "",
	need: "",
	contacted: "",
	q: "",
};

export const PAGE_SIZE = 20;

function countList(data: JsonRecord, key: string, label: string): CountBy[] {
	return expectArray(data, key).map((value) => {
		const item = expectRecord(value, key);
		return {
			key: expectString(item, label),
			count: expectNumber(item, "count"),
		};
	});
}

function filterQuery(filter: ProInterestFilter): URLSearchParams {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(filter)) {
		const trimmed = value.trim();
		if (trimmed) params.set(key, trimmed);
	}
	return params;
}

export async function fetchStats(): Promise<ProInterestStats> {
	const data = expectRecord(await apiRequest(`${BASE}/stats`), "stats");
	return {
		total: expectNumber(data, "total"),
		new7d: expectNumber(data, "new7d"),
		new30d: expectNumber(data, "new30d"),
		bySource: countList(data, "bySource", "source"),
		byNeed: countList(data, "byNeed", "need"),
	};
}

export async function fetchInterests(
	filter: ProInterestFilter,
	page: number,
): Promise<ProInterestPage> {
	const params = filterQuery(filter);
	params.set("page", String(page));
	params.set("pageSize", String(PAGE_SIZE));
	const data = expectRecord(
		await apiRequest(`${BASE}?${params.toString()}`),
		"pro interest page",
	);
	return {
		items: expectArray(data, "items").map(parseItem),
		total: expectNumber(data, "total"),
		page: expectNumber(data, "page"),
		pageSize: expectNumber(data, "pageSize"),
	};
}

export async function exportCsv(
	filter: ProInterestFilter,
): Promise<{ filename: string; csv: string }> {
	const query = filterQuery(filter).toString();
	const data = expectRecord(
		await apiRequest(`${BASE}/export${query ? `?${query}` : ""}`),
		"export",
	);
	return {
		filename: expectString(data, "filename"),
		csv: expectString(data, "csv"),
	};
}

export async function setContacted(
	id: string,
	contacted: boolean,
): Promise<ProInterestItem> {
	return parseItem(
		await apiRequest(`${BASE}/${encodeURIComponent(id)}/contacted`, {
			method: "PUT",
			body: { contacted },
		}),
	);
}

/** Dry run first (`preview: true`) so a wrong id fails before the real delete. */
export async function deleteInterest(
	id: string,
	{ preview = false }: { preview?: boolean } = {},
): Promise<void> {
	const query = preview ? "?dryRun=true" : "";
	await apiRequest(`${BASE}/${encodeURIComponent(id)}${query}`, {
		method: "DELETE",
	});
}

/** The API refuses admin calls from anyone but the owner. */
export function isForbidden(error: unknown): boolean {
	return error instanceof ApiError && error.status === 403;
}
