import { describe, expect, test } from "vitest";
import {
	isDeniedForwardPort,
	isLocalForwardPath,
	parseLocalPort,
} from "../constants.js";
import { isTuneloHeader, stripTuneloHeaders } from "../http-headers.js";

describe("isLocalForwardPath", () => {
	test("matches the forward path and what is under it", () => {
		expect(isLocalForwardPath("/.tunelo/forward")).toBe(true);
		expect(isLocalForwardPath("/.tunelo/forward/")).toBe(true);
		expect(isLocalForwardPath("/.tunelo/forward/api/users?x=1")).toBe(true);
		expect(isLocalForwardPath("/.tunelo/forward?x=1")).toBe(true);
		expect(isLocalForwardPath("/.TUNELO/Forward/x")).toBe(true);
	});

	test("leaves other paths alone", () => {
		expect(isLocalForwardPath("/")).toBe(false);
		expect(isLocalForwardPath("/.tunelo/forwarded")).toBe(false);
		expect(isLocalForwardPath("/api/.tunelo/forward")).toBe(false);
		expect(isLocalForwardPath("/.tunelo")).toBe(false);
	});
});

describe("parseLocalPort", () => {
	test("accepts 1–65535 written as digits", () => {
		expect(parseLocalPort("1")).toBe(1);
		expect(parseLocalPort("5173")).toBe(5173);
		expect(parseLocalPort("65535")).toBe(65_535);
		// Leading zeros name the same port, so the deny list still applies.
		expect(parseLocalPort("09222")).toBe(9222);
	});

	test("refuses anything else", () => {
		for (const value of [
			"0",
			"65536",
			"-1",
			"80a",
			" 80",
			"",
			"1e3",
			"80, 9222",
		]) {
			expect(parseLocalPort(value)).toBeNull();
		}
		expect(parseLocalPort(undefined)).toBeNull();
		expect(parseLocalPort(["80"])).toBeNull();
	});
});

test("the deny list holds admin, debug, automation and store ports", () => {
	for (const port of [
		2375, 2376, 2379, 2380, 4444, 5005, 5984, 6379, 8200, 8500, 9200, 9222,
		9229, 9300, 9515, 10250, 10255, 11211, 11434, 15672, 63342,
	]) {
		expect(isDeniedForwardPort(port)).toBe(true);
	}
	expect(isDeniedForwardPort(5173)).toBe(false);
});

test("stripTuneloHeaders drops every tunelo-* header, any case", () => {
	expect(
		stripTuneloHeaders({
			"Tunelo-Forward-Granted": "1",
			"tunelo-access": "t",
			"TUNELO-LOCAL-PORT": "80",
			accept: "*/*",
			"x-tunelo-note": "kept",
		}),
	).toEqual({ accept: "*/*", "x-tunelo-note": "kept" });
	expect(isTuneloHeader("Tunelo-Anything")).toBe(true);
	expect(isTuneloHeader("x-tunelo")).toBe(false);
});
