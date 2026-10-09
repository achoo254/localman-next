import type {
	HeaderEntry,
	PreparedRequest,
	RouteMode,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import {
	type RouteContext,
	mayHaveReachedTarget,
	planRoute,
	routeTarget,
} from "./route-plan";

const TUNNEL = "https://demo.tunnel.hoandat.com";

function plan(
	url: string,
	overrides: Partial<RouteContext> & { mode?: RouteMode } = {},
) {
	const target = routeTarget(url);
	if (!target) throw new Error(`not a URL: ${url}`);
	return planRoute(
		{
			mode: "auto",
			headers: [],
			followRedirects: true,
			pinnedHosts: new Set(),
			corsBlocked: () => false,
			tunnelFor: () => null,
			...overrides,
		},
		target,
	);
}

describe("planRoute", () => {
	it("sends straight from the browser in Auto when nothing stops it", () => {
		expect(plan("https://api.test/users")).toEqual({
			hop: "direct",
			strict: false,
			forbidden: [],
		});
	});

	it("goes through the proxy for a header fetch cannot set", () => {
		const headers: HeaderEntry[] = [{ name: "Cookie", value: "a=1" }];
		expect(plan("https://api.test/", { headers })).toEqual({
			hop: "proxy",
			why: "forbidden",
			forbidden: ["Cookie"],
		});
	});

	it("goes through the proxy when redirects must not be followed", () => {
		expect(plan("https://api.test/", { followRedirects: false })).toMatchObject(
			{ hop: "proxy", why: "redirects" },
		);
	});

	it("honours pinned hosts (with or without port) and the CORS cache", () => {
		const pinnedHosts = new Set(["api.test"]);
		expect(plan("https://api.test:8443/", { pinnedHosts })).toMatchObject({
			hop: "proxy",
			why: "pinned",
		});
		const corsBlocked = (origin: string) => origin === "https://cors.test";
		expect(plan("https://cors.test/x", { corsBlocked })).toMatchObject({
			hop: "proxy",
			why: "remembered",
		});
		expect(plan("https://other.test/x", { corsBlocked }).hop).toBe("direct");
	});

	it("respects the route chosen for the request", () => {
		const headers: HeaderEntry[] = [{ name: "Cookie", value: "a=1" }];
		expect(plan("https://api.test/", { mode: "direct", headers })).toEqual({
			hop: "direct",
			strict: true,
			forbidden: ["Cookie"],
		});
		expect(plan("https://api.test/", { mode: "proxy" })).toMatchObject({
			hop: "proxy",
			why: "manual",
		});
	});

	it("never sends a local target to the proxy itself", () => {
		for (const url of [
			"http://localhost:3000/a",
			"http://127.1:3000/",
			"http://[::1]:3000/",
			"http://192.168.1.5:8080/",
		]) {
			expect(plan(url, { mode: "proxy" }), url).toEqual({ hop: "needTunnel" });
			const headers: HeaderEntry[] = [{ name: "Cookie", value: "a" }];
			expect(plan(url, { headers }).hop, url).toBe("direct");
		}
	});

	it("uses the enabled tunnel of a local target when it cannot go direct", () => {
		const tunnelFor = (key: string) =>
			key === "localhost:3000" ? TUNNEL : null;
		expect(
			plan("http://127.0.0.1:3000/a", { mode: "proxy", tunnelFor }),
		).toEqual({
			hop: "tunnel",
			why: "manual",
			tunnelUrl: TUNNEL,
			forbidden: [],
		});
		const corsBlocked = () => true;
		expect(
			plan("http://localhost:3000/a", { tunnelFor, corsBlocked }),
		).toMatchObject({ hop: "tunnel", why: "remembered" });
		expect(plan("http://localhost:3000/a", { tunnelFor }).hop).toBe("direct");
		expect(
			plan("http://localhost:4000/a", { mode: "proxy", tunnelFor }),
		).toEqual({ hop: "needTunnel" });
	});
});

function prepared(
	method: PreparedRequest["method"],
	headers: HeaderEntry[],
): PreparedRequest {
	return {
		method,
		url: "https://api.test/",
		headers,
		body: { kind: "none" },
		secretsUsed: [],
		unresolved: [],
	};
}

describe("mayHaveReachedTarget", () => {
	it("is true for methods that are not idempotent, whatever the headers", () => {
		const form = { name: "Content-Type", value: "text/plain;charset=UTF-8" };
		const json = { name: "Content-Type", value: "application/json" };
		expect(mayHaveReachedTarget(prepared("POST", [form]))).toBe(true);
		expect(mayHaveReachedTarget(prepared("POST", [json]))).toBe(true);
		expect(mayHaveReachedTarget(prepared("PATCH", [json]))).toBe(true);
		expect(mayHaveReachedTarget(prepared("GET", []))).toBe(false);
		expect(mayHaveReachedTarget(prepared("PUT", [json]))).toBe(false);
		expect(mayHaveReachedTarget(prepared("DELETE", []))).toBe(false);
	});
});
