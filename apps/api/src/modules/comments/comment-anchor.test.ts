import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	type CommentTarget,
	anchorOutdated,
	commentAnchorSchema,
} from "./comment-anchor.js";

const request: CommentTarget = {
	kind: "request",
	draft: createRequestDraft({
		url: "https://api.example.com/orders/{{id}}",
		params: [{ id: "p1", key: "page", value: "2", enabled: true }],
		scripts: { pre: "lm.variables.set('a', 1);", post: "" },
	}),
};

describe("comment anchors", () => {
	it("match the quoted text at its place in url, rows and scripts", () => {
		expect(
			anchorOutdated(request, {
				part: "url",
				start: 31,
				end: 37,
				quote: "{{id}}",
			}),
		).toBe(false);
		expect(
			anchorOutdated(request, {
				part: "params",
				rowId: "p1",
				field: "key",
				start: 0,
				end: 4,
				quote: "page",
			}),
		).toBe(false);
		expect(
			anchorOutdated(request, {
				part: "preScript",
				start: 0,
				end: 12,
				quote: "lm.variables",
			}),
		).toBe(false);
	});

	it("are outdated when the row is gone or the text moved", () => {
		const base = { field: "value" as const, start: 0, end: 1, quote: "2" };
		expect(
			anchorOutdated(request, { part: "params", rowId: "p2", ...base }),
		).toBe(true);
		expect(
			anchorOutdated(request, {
				part: "url",
				start: 0,
				end: 5,
				quote: "http:",
			}),
		).toBe(true);
	});

	it("only offer scripts on folders and the collection, nothing on examples", () => {
		const folder: CommentTarget = {
			kind: "folder",
			scripts: { pre: "x", post: "" },
		};
		expect(
			anchorOutdated(folder, {
				part: "preScript",
				start: 0,
				end: 1,
				quote: "x",
			}),
		).toBe(false);
		expect(
			anchorOutdated(folder, { part: "body", start: 0, end: 1, quote: "x" }),
		).toBe(true);
		expect(
			anchorOutdated(
				{ kind: "example" },
				{ part: "url", start: 0, end: 1, quote: "h" },
			),
		).toBe(true);
	});

	it("need a row and cell exactly for params and headers", () => {
		const anchor = { start: 0, end: 1, quote: "a" };
		expect(
			commentAnchorSchema.safeParse({ part: "headers", ...anchor }).success,
		).toBe(false);
		expect(
			commentAnchorSchema.safeParse({
				part: "body",
				rowId: "r",
				field: "key",
				...anchor,
			}).success,
		).toBe(false);
		expect(
			commentAnchorSchema.safeParse({
				part: "body",
				start: 3,
				end: 3,
				quote: "a",
			}).success,
		).toBe(false);
	});
});
