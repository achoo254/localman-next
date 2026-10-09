import { describe, expect, it } from "vitest";
import type { HistoryEntry } from "./history-api";
import { dayKey, filterHistory, groupHistoryByDay } from "./history-groups";

function entry(
	id: string,
	createdAt: string,
	overrides: Partial<HistoryEntry> = {},
): HistoryEntry {
	return {
		id,
		name: "",
		method: "GET",
		url: `https://api.example.com/${id}`,
		response: { status: 200, ms: 10, size: 2, route: "proxy", finalUrl: null },
		bodyOmitted: false,
		createdAt,
		...overrides,
	};
}

// 2026-10-10 09:00 in Asia/Saigon.
const NOW = new Date("2026-10-10T02:00:00.000Z");

describe("groupHistoryByDay", () => {
	it("groups by Asia/Saigon day, not UTC", () => {
		// 23:30 UTC on Oct 9 is 06:30 on Oct 10 in Saigon.
		expect(dayKey(new Date("2026-10-09T23:30:00.000Z"))).toBe("2026-10-10");
		expect(dayKey(new Date("not a date"))).toBe("");
	});

	it("labels today and yesterday, then dates, keeping the API's order", () => {
		const groups = groupHistoryByDay(
			[
				entry("a", "2026-10-10T01:00:00.000Z"),
				entry("b", "2026-10-09T23:30:00.000Z"),
				entry("c", "2026-10-09T10:00:00.000Z"),
				entry("d", "2026-10-01T10:00:00.000Z"),
			],
			NOW,
		);
		expect(
			groups.map((g) => [g.day, g.kind, g.entries.map((e) => e.id).join("")]),
		).toEqual([
			["2026-10-10", "today", "ab"],
			["2026-10-09", "yesterday", "c"],
			["2026-10-01", "date", "d"],
		]);
	});
});

describe("filterHistory", () => {
	const entries = [
		entry("users", "2026-10-10T01:00:00.000Z"),
		entry("orders", "2026-10-10T01:00:00.000Z", {
			method: "POST",
			name: "Create order",
		}),
	];

	it("matches URL or name, case-insensitive", () => {
		expect(
			filterHistory(entries, { query: "CREATE", method: "ALL" }).map(
				(e) => e.id,
			),
		).toEqual(["orders"]);
		expect(
			filterHistory(entries, { query: "users", method: "ALL" }).map(
				(e) => e.id,
			),
		).toEqual(["users"]);
	});

	it("filters by method", () => {
		expect(
			filterHistory(entries, { query: "", method: "POST" }).map((e) => e.id),
		).toEqual(["orders"]);
	});
});
