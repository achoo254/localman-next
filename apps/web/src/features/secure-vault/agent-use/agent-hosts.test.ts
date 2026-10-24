import { describe, expect, it } from "vitest";
import { withAgentCopies } from "./agent-copy";
import {
	agentHostsLabel,
	hostSuggestions,
	hostsSavable,
	isAppHost,
	parseAgentHosts,
	refusedHosts,
	refusedLines,
} from "./agent-hosts";

const APP = "app.localman.test";

describe("hosts typed for agents", () => {
	it("keeps valid hosts, lowercased, and skips blank lines", () => {
		const parsed = parseAgentHosts("API.Example.com\n\n  *.example.org  ", APP);
		expect(parsed).toEqual({
			hosts: ["api.example.com", "*.example.org"],
			errors: [],
			tooMany: false,
		});
		expect(hostsSavable(parsed)).toBe(true);
	});

	it("says what is wrong on each line", () => {
		const parsed = parseAgentHosts(
			[
				"https://api.example.com",
				"api.example.com:8443",
				"api.example.com/v1",
				"not a host",
				"*.com",
				"*.co.uk",
				"*.herokuapp.com",
				"my-app.herokuapp.com",
				"my-app.herokuapp.com",
				"api.app.localman.test",
			].join("\n"),
			APP,
		);
		expect(parsed.hosts).toEqual(["my-app.herokuapp.com"]);
		expect(parsed.errors.map((e) => [e.line, e.problem])).toEqual([
			[1, { kind: "scheme" }],
			[2, { kind: "scheme" }],
			[3, { kind: "scheme" }],
			[4, { kind: "format" }],
			[5, { kind: "open" }],
			[6, { kind: "open" }],
			[7, { kind: "open" }],
			[9, { kind: "duplicate", line: 8 }],
			[10, { kind: "app" }],
		]);
		expect(hostsSavable(parsed)).toBe(false);
	});

	it("flags an invalid host name as a format problem", () => {
		const parsed = parseAgentHosts("-bad-.example.com", APP);
		expect(parsed.errors[0]?.problem).toEqual({ kind: "format" });
	});

	it("needs one to twenty hosts", () => {
		expect(hostsSavable(parseAgentHosts("  \n", APP))).toBe(false);
		const many = Array.from({ length: 21 }, (_, i) => `h${i}.example.com`);
		const parsed = parseAgentHosts(many.join("\n"), APP);
		expect(parsed.tooMany).toBe(true);
		expect(hostsSavable(parsed)).toBe(false);
	});

	it("catches the app's own host under a wildcard either way", () => {
		expect(isAppHost("*.localman.test", APP)).toBe(true);
		expect(isAppHost("*.app.localman.test", APP)).toBe(true);
		expect(isAppHost("*.example.com", APP)).toBe(false);
		expect(isAppHost("localman.test", APP)).toBe(false);
	});
});

describe("server answers and labels", () => {
	it("reads the hosts a 400 refused and finds their lines", () => {
		const hosts = refusedHosts({ hosts: "mock.example.com, T.example.com" });
		expect(hosts).toEqual(["mock.example.com", "t.example.com"]);
		expect(refusedHosts("nope")).toEqual([]);
		expect(
			refusedLines("api.example.com\nMock.example.com", hosts).map(
				(e) => e.line,
			),
		).toEqual([2]);
	});

	it("shows the first host and how many more", () => {
		expect(agentHostsLabel(["a.example.com"])).toBe("a.example.com");
		expect(agentHostsLabel(["a.example.com", "b.test", "c.test"])).toBe(
			"a.example.com +2",
		);
	});
});

describe("suggestions from base URLs", () => {
	it("starts with the scope's own host, then others, without repeats", () => {
		const own = [
			{ key: "baseUrl", values: ["https://api.example.com/v1", undefined] },
			{ key: "token", values: ["https://ignored.example.com"] },
		];
		const others = [
			{ key: "apiHost", values: ["https://api.example.com", null] },
			{ key: "authUrl", values: ["http://auth.example.org", "{{base}}/x"] },
			{ key: "mockUrl", values: [`https://${APP}/m`, "not a url"] },
		];
		expect(hostSuggestions(own, others, APP)).toEqual({
			prefill: "api.example.com",
			all: ["api.example.com", "auth.example.org"],
		});
	});
});

describe("copies for agents", () => {
	it("adds the copy to values set for names whose use is on", () => {
		const keys = new Set(["token"]);
		expect(
			withAgentCopies(
				[
					{ key: "token", value: "new" },
					{ key: "token", value: null },
					{ key: "other", value: "x" },
				],
				keys,
			),
		).toEqual([
			{ key: "token", value: "new", agentValue: "new" },
			{ key: "token", value: null },
			{ key: "other", value: "x" },
		]);
	});
});
