import { describe, expect, it } from "vitest";
import {
	NO_FILTERS,
	filterQuery,
	filtersActive,
	filtersFromSearch,
} from "./log-filters";
import { parseLogEvent } from "./request-log-parse";
import { logRow } from "./request-log-test-utils";
import { mergeRows } from "./use-live-rows";

describe("request log filters", () => {
	it("builds the query the list and the stream share", () => {
		expect(filterQuery(NO_FILTERS)).toBe("");
		expect(filtersActive({ ...NO_FILTERS, path: "  " })).toBe(false);
		const filters = {
			method: "GET",
			status: "4xx",
			source: "rule",
			path: " /a b ",
		} as const;
		expect(filtersActive(filters)).toBe(true);
		expect(filterQuery(filters)).toBe(
			"method=GET&status=4xx&source=rule&path=%2Fa+b",
		);
	});

	it("reads only known filters from the page address", () => {
		const params = new URLSearchParams(
			"logMethod=TRACE&logStatus=5xx&logSource=inbox&logPath=%2F_inbox%2Fx",
		);
		expect(filtersFromSearch(params)).toEqual({
			method: "",
			status: "5xx",
			source: "inbox",
			path: "/_inbox/x",
		});
		expect(filtersFromSearch(new URLSearchParams("logSource=nope"))).toEqual(
			NO_FILTERS,
		);
	});
});

describe("request log rows", () => {
	it("merges live and listed rows newest first without duplicates", () => {
		const old = logRow("a", { at: "2026-10-10T01:00:00.000Z" });
		const mid = logRow("b", { at: "2026-10-10T02:00:00.000Z" });
		const fresh = logRow("c", { at: "2026-10-10T03:00:00.000Z" });
		const live = [fresh, mid].map((row) => parseLogEvent(JSON.stringify(row)));
		const listed = [mid, old].map((row) => parseLogEvent(JSON.stringify(row)));
		const rows = mergeRows(
			live.filter((row) => row !== null),
			listed.filter((row) => row !== null),
		);
		expect(rows.map((row) => row.id)).toEqual(["c", "b", "a"]);
	});

	it("ignores events that are not rows", () => {
		expect(parseLogEvent("not json")).toBeNull();
		expect(parseLogEvent("[]")).toBeNull();
		expect(
			parseLogEvent(JSON.stringify(logRow("a", { source: "elsewhere" }))),
		).toBeNull();
	});
});
