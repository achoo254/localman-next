import { describe, expect, test } from "vitest";
import { needsUnbufferedRelay } from "../http-headers.js";

describe("needsUnbufferedRelay", () => {
	test("true for SSE responses", () => {
		expect(needsUnbufferedRelay({ "content-type": "text/event-stream" })).toBe(
			true,
		);
	});

	test("true when no content-length (chunked / unknown length)", () => {
		expect(needsUnbufferedRelay({ "content-type": "application/json" })).toBe(
			true,
		);
	});

	test("false for length-bounded static responses", () => {
		expect(
			needsUnbufferedRelay({
				"content-type": "text/html; charset=utf-8",
				"content-length": "1234",
			}),
		).toBe(false);
	});

	test("detects headers case-insensitively", () => {
		expect(
			needsUnbufferedRelay({
				"Content-Type": "text/html",
				"Content-Length": "10",
			}),
		).toBe(false);
		expect(needsUnbufferedRelay({ "Content-Type": "text/event-stream" })).toBe(
			true,
		);
	});

	test("SSE wins even when a content-length is present", () => {
		expect(
			needsUnbufferedRelay({
				"content-type": "text/event-stream",
				"content-length": "42",
			}),
		).toBe(true);
	});

	test("handles array-valued content-type", () => {
		expect(
			needsUnbufferedRelay({
				"content-type": ["text/event-stream"],
				"content-length": "5",
			}),
		).toBe(true);
	});
});
