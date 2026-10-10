import { describe, expect, it } from "vitest";
import {
	pathSegments,
	readMockAddress,
	stripPrefix,
} from "./resolve-project.js";
import { matchRoute } from "./route-matcher.js";
import { TtlLruCache } from "./ttl-lru-cache.js";

const SECRET = "k3x9q2m7v1c8b4n6z0w5r2t8";

describe("readMockAddress", () => {
	it("reads the secret from the host, ignoring case and ports", () => {
		expect(
			readMockAddress(
				`${SECRET.toUpperCase()}.localman.hoandat.com`,
				"/api/users/1",
				"localman.hoandat.com",
			),
		).toEqual({
			secret: SECRET,
			segments: ["api", "users", "1"],
			rawPath: "/api/users/1",
		});
		expect(
			readMockAddress(`${SECRET}.localtest.me`, "/users", "localtest.me:4100"),
		).toEqual({ secret: SECRET, segments: ["users"], rawPath: "/users" });
	});

	it("falls back to /m/:secret on other hosts", () => {
		expect(
			readMockAddress("localhost", `/m/${SECRET}/users/`, "localtest.me"),
		).toEqual({
			secret: SECRET,
			segments: ["users"],
			rawPath: "/users/",
		});
		expect(
			readMockAddress("localhost", `/m/${SECRET}/a%20b`, "localtest.me")
				?.rawPath,
		).toBe("/a%20b");
		expect(
			readMockAddress("localhost", `/m/${SECRET}`, "localtest.me")?.rawPath,
		).toBe("/");
		expect(readMockAddress("localhost", "/healthz", "localtest.me")).toBeNull();
		expect(readMockAddress("localhost", "/m", "localtest.me")).toBeNull();
	});

	it("refuses labels that are not one DNS label", () => {
		for (const host of [
			`a.${SECRET}.localtest.me`,
			"-bad.localtest.me",
			"bad_label.localtest.me",
			`${"a".repeat(64)}.localtest.me`,
			"localtest.me",
			`${SECRET}.localtest.me.evil.com`,
		]) {
			expect(readMockAddress(host, "/users", "localtest.me"), host).toBeNull();
		}
		expect(
			readMockAddress("localhost", "/m/bad_secret/users", "x.test"),
		).toBeNull();
	});
});

describe("pathSegments and stripPrefix", () => {
	it("decodes segments and rejects malformed paths", () => {
		expect(pathSegments("/a/b%20c/")).toEqual(["a", "b c"]);
		expect(pathSegments("/")).toEqual([]);
		expect(pathSegments("/a//b")).toBeNull();
		expect(pathSegments("/a/%E0%A4%A")).toBeNull();
		expect(pathSegments(`/${"a/".repeat(80)}`)).toBeNull();
	});

	it("strips the project prefix case-sensitively", () => {
		expect(stripPrefix(["api", "v1", "users"], "/api/v1")).toEqual(["users"]);
		expect(stripPrefix(["users"], "")).toEqual(["users"]);
		expect(stripPrefix(["Api", "v1", "users"], "/api/v1")).toBeNull();
		expect(stripPrefix(["api"], "/api/v1")).toBeNull();
	});
});

describe("TtlLruCache", () => {
	it("expires entries and evicts the least recently used", () => {
		let now = 0;
		const cache = new TtlLruCache<number>(2, 1000, () => now);
		cache.set("a", 1);
		cache.set("b", 2);
		expect(cache.get("a")).toBe(1);
		cache.set("c", 3);
		expect(cache.get("b")).toBeUndefined();
		expect(cache.get("a")).toBe(1);
		now = 1000;
		expect(cache.get("a")).toBeUndefined();
		expect(cache.size).toBe(1);
	});
});

describe("matchRoute", () => {
	const nodes = [
		{ id: "u", parentId: null, name: "users" },
		{ id: "p", parentId: "u", name: "posts" },
		{ id: "c", parentId: "p", name: "comments" },
		{ id: "S", parentId: null, name: "Side" },
		{ id: "s", parentId: null, name: "side" },
		{ id: "t1", parentId: "u", name: "tags" },
		{ id: "t2", parentId: "p", name: "tags" },
	];
	const ids = (segments: string[]) =>
		matchRoute(nodes, segments)?.map(
			(step) => `${step.node.id}:${step.recordId}`,
		) ?? null;

	it("walks nested routes of any depth", () => {
		expect(ids(["users"])).toEqual(["u:null"]);
		expect(ids(["users", "1", "posts", "2", "comments"])).toEqual([
			"u:1",
			"p:2",
			"c:null",
		]);
		expect(ids(["users", "1", "posts", "2", "comments", "3"])).toEqual([
			"u:1",
			"p:2",
			"c:3",
		]);
	});

	it("keeps flat routes of nested resources when the name is unambiguous", () => {
		expect(ids(["comments", "5"])).toEqual(["c:5"]);
		expect(ids(["posts", "2", "comments"])).toEqual(["p:2", "c:null"]);
		expect(ids(["tags"])).toBeNull();
		expect(ids(["users", "1", "tags"])).toEqual(["u:1", "t1:null"]);
	});

	it("compares names case-sensitively and refuses unknown names", () => {
		expect(ids(["Side"])).toEqual(["S:null"]);
		expect(ids(["side"])).toEqual(["s:null"]);
		expect(ids(["SIDE"])).toBeNull();
		expect(ids(["users", "1", "comments"])).toBeNull();
		expect(ids(["__proto__"])).toBeNull();
		expect(ids([])).toBeNull();
	});
});
