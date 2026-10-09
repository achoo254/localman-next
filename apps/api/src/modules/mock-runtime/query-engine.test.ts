import type { JsonObject } from "@localman/shared";
import { describe, expect, it } from "vitest";
import {
	MAX_PAGE_LIMIT,
	type QueryFields,
	applyListQuery,
	parseListQuery,
} from "./query-engine.js";
import { crossedThresholds } from "./quota-warnings.js";
import { MockLimiters, WindowRateLimiter } from "./rate-limit.js";

const FIELDS: QueryFields = {
	fields: new Set(["title", "completed", "rank", "meta"]),
	exact: new Set(["id", "userId"]),
};

const records: JsonObject[] = Array.from({ length: 12 }, (_, index) => ({
	id: String(index + 1),
	userId: String((index % 3) + 1),
	title: index % 2 === 0 ? `Hello ${index + 1}` : `Bye ${index + 1}`,
	completed: index % 4 === 0,
	rank: 12 - index,
	meta: { nested: "hello" },
}));

const run = (query: Record<string, unknown>) =>
	applyListQuery(records, parseListQuery(query, FIELDS));
const idsOf = (query: Record<string, unknown>) =>
	run(query).items.map((record) => record.id);

describe("query engine", () => {
	it("searches every string field, case-insensitively", () => {
		expect(idsOf({ search: "hello 1" })).toEqual(["1", "11"]);
		expect(idsOf({ filter: "BYE" })).toHaveLength(6);
		expect(idsOf({ search: "12" })).toEqual(["12"]);
	});

	it("filters schema fields with the value coerced to the field's type (AND)", () => {
		expect(idsOf({ completed: "true" })).toEqual(["1", "5", "9"]);
		expect(idsOf({ completed: "false", title: "hello" })).toEqual([
			"3",
			"7",
			"11",
		]);
		expect(idsOf({ rank: "10" })).toEqual(["3"]);
		expect(idsOf({ rank: "ten" })).toEqual([]);
		expect(idsOf({ meta: "hello" })).toEqual([]);
		expect(idsOf({ userId: "1" })).toEqual(["1", "4", "7", "10"]);
		expect(idsOf({ id: "1" })).toEqual(["1"]);
		expect(idsOf({ unknownField: "x" })).toHaveLength(12);
	});

	it("sorts by real fields, ids numerically, asc by default", () => {
		expect(idsOf({ sortBy: "rank" }).slice(0, 3)).toEqual(["12", "11", "10"]);
		expect(idsOf({ orderby: "id", order: "desc" }).slice(0, 3)).toEqual([
			"12",
			"11",
			"10",
		]);
		expect(idsOf({ sortby: "title" })[0]).toBe("10");
		expect(idsOf({ orderBy: "missing" })).toEqual(idsOf({}));
		expect(idsOf({ sortBy: "id", order: "DESC" })[0]).toBe("12");
		expect(idsOf({ sortBy: "id", order: "Desc" })[0]).toBe("12");
		expect(idsOf({ sortBy: "id", order: "ASC" })[0]).toBe("1");
	});

	it("pages with page/p and limit/l, up to 100 per page", () => {
		expect(idsOf({ page: "2", limit: "5" })).toEqual([
			"6",
			"7",
			"8",
			"9",
			"10",
		]);
		expect(idsOf({ p: "3", l: "5" })).toEqual(["11", "12"]);
		expect(idsOf({ limit: "5" })).toHaveLength(5);
		expect(idsOf({ page: "2" })).toHaveLength(12);
		expect(idsOf({ limit: "0" })).toHaveLength(12);
		expect(idsOf({ limit: "-1" })).toHaveLength(12);
		const many = Array.from({ length: 150 }, (_, i) => ({ id: String(i + 1) }));
		const query = parseListQuery({ limit: "1000" }, FIELDS);
		expect(applyListQuery(many, query).items).toHaveLength(MAX_PAGE_LIMIT);
		expect(run({ title: "hello", limit: "2" }).total).toBe(6);
	});

	it("refuses operator, dotted, bracketed and prototype names with 400", () => {
		for (const query of [
			{ $where: "1" },
			{ "title[$ne]": "x" },
			{ "meta.nested": "x" },
			JSON.parse('{"__proto__":"x"}'),
			{ constructor: "x" },
			{ sortBy: "__proto__" },
			{ sortBy: "$natural" },
			{ orderBy: "a.b" },
			{ title: ["a", "b"] },
			{ title: { $ne: "x" } },
		]) {
			expect(
				() => parseListQuery(query, FIELDS),
				JSON.stringify(query),
			).toThrowError(
				expect.objectContaining({ status: 400, code: "INVALID_QUERY" }),
			);
		}
	});

	it("never reads inherited properties", () => {
		const fields: QueryFields = {
			fields: new Set(["toString"]),
			exact: new Set(),
		};
		const query = parseListQuery(
			{ toString: "function", sortBy: "toString" },
			fields,
		);
		expect(applyListQuery([{ id: "1" }], query).items).toEqual([]);
	});
});

describe("WindowRateLimiter", () => {
	it("allows max hits per window and tells when to retry", () => {
		let now = 10_250;
		const limiter = new WindowRateLimiter(2, 1000, () => now);
		expect(limiter.take("a").ok).toBe(true);
		expect(limiter.take("a").ok).toBe(true);
		expect(limiter.take("a")).toEqual({ ok: false, retryAfterSeconds: 1 });
		expect(limiter.take("b").ok).toBe(true);
		now = 11_000;
		expect(limiter.take("a").ok).toBe(true);
		expect(limiter.size).toBe(1);
	});
});

describe("byte budgets", () => {
	it("refuses once a window's amount reaches the budget, then resets", () => {
		let now = 5_100;
		const limiter = new WindowRateLimiter(1_000, 1000, () => now);
		expect(limiter.check("s").ok).toBe(true);
		limiter.add("s", 999);
		expect(limiter.check("s").ok).toBe(true);
		limiter.add("s", 1_500);
		expect(limiter.check("s")).toEqual({ ok: false, retryAfterSeconds: 1 });
		expect(limiter.check("other").ok).toBe(true);
		now = 6_000;
		expect(limiter.check("s").ok).toBe(true);
	});

	it("checks IP, secret, writes and bytes in order", () => {
		const limiters = new MockLimiters(
			{
				perIp: 100,
				perSecret: 100,
				writesPerSecret: 1,
				responseBytesPerSecret: 10,
			},
			() => 0,
		);
		expect(limiters.admit("198.51.100.1", "s", "POST").ok).toBe(true);
		expect(limiters.admit("198.51.100.1", "s", "PATCH").ok).toBe(false);
		expect(limiters.admit("198.51.100.1", "s", "GET").ok).toBe(true);
		limiters.chargeResponse("s", 10);
		expect(limiters.admit("198.51.100.1", "s", "GET").ok).toBe(false);
	});
});

describe("crossedThresholds", () => {
	it("reports each threshold in the step that passes it", () => {
		expect(crossedThresholds(10_000, 7_999, 8_000)).toEqual([80]);
		expect(crossedThresholds(10_000, 8_000, 9_000)).toEqual([]);
		expect(crossedThresholds(10_000, 7_000, 10_000)).toEqual([80, 100]);
		expect(crossedThresholds(null, 0, 1e9)).toEqual([]);
	});
});
