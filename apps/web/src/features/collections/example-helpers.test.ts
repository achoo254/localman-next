import { EXAMPLE_BODY_MAX } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { planBulkDelete, rowRange } from "./bulk-plan";
import { detail, folder, request, summary } from "./collections-test-utils";
import { cutToBytes, fitExampleResponse } from "./example-body";
import {
	blankExampleResponse,
	exampleFromResponse,
	exampleName,
} from "./example-response";
import { validExampleStatus } from "./example-response-form";
import { buildTreeRows } from "./tree-rows";
import type { DetailState } from "./use-collections";

describe("example bodies", () => {
	it("cuts by UTF-8 bytes on a character boundary", () => {
		expect(cutToBytes("abc", 3)).toEqual({ text: "abc", cut: false });
		// "é" takes 2 bytes, "😀" 4: a cut never splits them.
		expect(cutToBytes("aé😀", 4)).toEqual({ text: "aé", cut: true });
		const big = {
			...blankExampleResponse(),
			body: "x".repeat(EXAMPLE_BODY_MAX + 5),
		};
		const fitted = fitExampleResponse(big);
		expect(fitted.cut).toBe(true);
		expect(new TextEncoder().encode(fitted.response.body).length).toBe(
			EXAMPLE_BODY_MAX,
		);
	});

	it("saves a received response with its headers and language", () => {
		let n = 0;
		const example = exampleFromResponse(
			{
				status: 201,
				statusText: "Created",
				headers: [
					{ name: "Content-Type", value: "application/json; charset=utf-8" },
				],
				body: '{"id":1}',
				bodyEncoding: "utf8",
				size: 8,
				timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
				finalUrl: "https://a.test",
				truncated: false,
			},
			() => `h${++n}`,
		);
		expect(example).toMatchObject({
			status: 201,
			bodyLanguage: "json",
			body: '{"id":1}',
		});
		expect(example.headers[0]).toEqual({
			id: "h1",
			key: "Content-Type",
			value: "application/json; charset=utf-8",
			enabled: true,
		});
		expect(exampleName(example)).toBe("201 Created");
	});

	it("accepts statuses 100 to 599 only", () => {
		expect([99, 100, 404, 599, 600, 200.5].map(validExampleStatus)).toEqual([
			false,
			true,
			true,
			true,
			false,
			false,
		]);
	});
});

describe("bulk delete plan", () => {
	const shop = detail("c1", [
		folder("f1", null, "a0"),
		request("r1", "f1", "a0"),
	]);
	const details = new Map<string, DetailState>([
		["c1", { status: "ready", detail: shop }],
	]);
	const rows = buildTreeRows({
		collections: [summary("c1", { requestCount: 1 }), summary("c2")],
		details,
		expanded: new Set(["c1", "f1"]),
	});

	it("trashes picked collections and leaves their nodes to them", () => {
		const plan = planBulkDelete(
			rows.filter((row) => ["c1", "r1", "c2"].includes(row.id)),
		);
		expect(plan.collections.map((c) => c.id)).toEqual(["c1", "c2"]);
		expect([...plan.nodes]).toEqual([]);
		expect(plan.total).toBe(2);
	});

	it("deletes picked nodes per collection, and ranges follow tree order", () => {
		const plan = planBulkDelete(
			rows.filter((row) => row.id === "f1" || row.id === "r1"),
		);
		expect([...plan.nodes]).toEqual([["c1", ["f1", "r1"]]]);
		expect(rowRange(rows, "r1", "c1")).toEqual(["c1", "f1", "r1"]);
	});
});
