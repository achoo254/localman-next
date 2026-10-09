import { describe, expect, it } from "vitest";
import { basicCredentials } from "../auth-headers.js";
import { type CurlImport, parseCurlCommand } from "./curl-parser.js";

function parse(text: string): CurlImport {
	const result = parseCurlCommand(text);
	if (!result.ok) throw new Error(`import failed: ${result.error.code}`);
	return result.value;
}

const headerPairs = (imported: CurlImport): [string, string][] =>
	imported.draft.headers.map((h) => [h.key, h.value]);

describe("parseCurlCommand: options", () => {
	it("reads bundled and attached short options", () => {
		const { draft, warnings } = parse(
			"curl -sSL -XPUT -HX-A:1 https://a.com/x",
		);
		expect(draft.method).toBe("PUT");
		expect(headerPairs({ draft, warnings })).toEqual([["X-A", "1"]]);
		expect(warnings).toEqual([]);
	});

	it("keeps repeated headers in order and empty ones from `Name;`", () => {
		const imported = parse(
			"curl -H 'X-A: 1' -H 'x-a: 2' -H 'X-Empty;' --url https://a.com",
		);
		expect(headerPairs(imported)).toEqual([
			["X-A", "1"],
			["x-a", "2"],
			["X-Empty", ""],
		]);
	});

	it("joins several -d with & and fills params from the URL", () => {
		const { draft } = parse("curl 'https://a.com/s?q=a%20b&n=1' -d a=1 -d b=2");
		expect(draft.params.map((p) => [p.key, p.value])).toEqual([
			["q", "a b"],
			["n", "1"],
		]);
		expect(draft.body.urlencoded.map((r) => [r.key, r.value])).toEqual([
			["a", "1"],
			["b", "2"],
		]);
	});

	it("treats --data-raw '@…' as text and -d @file as a missing file", () => {
		const raw = parse("curl https://a.com --data-raw '@/etc/passwd'");
		expect(raw.draft.body).toMatchObject({ type: "raw", raw: "@/etc/passwd" });
		const file = parse("curl https://a.com -d @body.json");
		expect(file.draft.body.type).toBe("none");
		expect(file.warnings).toEqual([
			{ code: "FILE_NOT_INCLUDED", path: "", params: { name: "body.json" } },
		]);
	});

	it("url-encodes --data-urlencode pieces", () => {
		const { draft } = parse(
			`curl https://a.com --data-urlencode 'q=a&b c' --data-urlencode 'n=Tiếng Việt'`,
		);
		expect(draft.body.urlencoded.map((r) => [r.key, r.value])).toEqual([
			["q", "a&b c"],
			["n", "Tiếng Việt"],
		]);
		const bare = parse("curl https://a.com --data-urlencode '=x y'");
		expect(bare.draft.body).toMatchObject({ type: "raw", raw: "x%20y" });
	});

	it("moves data into the query with -G", () => {
		const { draft } = parse("curl -G https://a.com/s?x=1 -d q=term -d page=2");
		expect(draft.method).toBe("GET");
		expect(draft.url).toBe("https://a.com/s?x=1&q=term&page=2");
		expect(draft.body.type).toBe("none");
	});

	it("reads -F text and file parts", () => {
		const { draft, warnings } = parse(
			"curl https://a.com -F name=Ann -F 'avatar=@/tmp/me.png;type=image/png' -H 'Content-Type: multipart/form-data; boundary=x'",
		);
		expect(draft.body.type).toBe("formdata");
		expect(draft.body.formData.map((r) => [r.key, r.kind, r.value])).toEqual([
			["name", "text", "Ann"],
			["avatar", "file", ""],
		]);
		expect(draft.headers).toEqual([]);
		expect(warnings[0]).toMatchObject({
			code: "FILE_NOT_INCLUDED",
			params: { name: "me.png" },
		});
	});

	it("turns Authorization headers into auth", () => {
		expect(
			parse("curl https://a.com -H 'Authorization: Bearer abc.def'").draft.auth,
		).toEqual({
			type: "bearer",
			token: "abc.def",
		});
		const credentials = basicCredentials("dùng", "mật");
		const basic = parse(
			`curl https://a.com -H 'authorization: Basic ${credentials}'`,
		);
		expect(basic.draft.auth).toEqual({
			type: "basic",
			username: "dùng",
			password: "mật",
		});
		expect(basic.draft.headers).toEqual([]);
		const other = parse("curl https://a.com -H 'Authorization: Digest x'");
		expect(other.draft.auth).toEqual({ type: "none" });
		expect(headerPairs(other)).toEqual([["Authorization", "Digest x"]]);
	});

	it("handles --json, -I, -A, -e, -b and -m", () => {
		const json = parse(`curl --json '{"a":1}' https://a.com`);
		expect(json.draft.method).toBe("POST");
		expect(headerPairs(json)).toEqual([["Accept", "application/json"]]);
		expect(json.draft.body.rawLanguage).toBe("json");
		const head = parse(
			"curl -I -A agent/1 -e https://ref -b 'a=1; b=2' -m 2.5 https://a.com",
		);
		expect(head.draft.method).toBe("HEAD");
		expect(headerPairs(head)).toEqual([
			["User-Agent", "agent/1"],
			["Referer", "https://ref"],
			["Cookie", "a=1; b=2"],
		]);
		expect(head.draft.settings.timeoutMs).toBe(2500);
	});

	it("keeps a raw body that is not form pairs, with curl's default type", () => {
		const { draft } = parse("curl https://a.com -d 'plain text\nline 2'");
		expect(draft.body).toMatchObject({
			type: "raw",
			rawLanguage: "text",
			raw: "plain text\nline 2",
		});
		expect(headerPairs({ draft, warnings: [] })).toEqual([
			["Content-Type", "application/x-www-form-urlencoded"],
		]);
	});

	it("keeps an explicit non-default Content-Type", () => {
		const { draft } = parse(
			`curl https://a.com -H 'Content-Type: application/vnd.api+json' -d '{"a":1}'`,
		);
		expect(draft.body.rawLanguage).toBe("json");
		expect(headerPairs({ draft, warnings: [] })).toEqual([
			["Content-Type", "application/vnd.api+json"],
		]);
	});

	it("warns about options it cannot honour and extra URLs", () => {
		const { warnings, draft } = parse(
			"curl -k --compressed -o out.txt --proxy http://p:1 -X BREW https://a.com https://b.com",
		);
		expect(draft.url).toBe("https://a.com");
		expect(draft.method).toBe("GET");
		expect(warnings.map((w) => [w.code, w.params])).toEqual([
			["UNSUPPORTED_OPTION", { option: "-k" }],
			["UNSUPPORTED_OPTION", { option: "--proxy" }],
			["EXTRA_URLS", { count: 1 }],
			["UNSUPPORTED_METHOD", { method: "BREW" }],
		]);
	});

	it("stops at an unquoted pipe", () => {
		const { draft } = parse("curl https://a.com/x | jq '.items'");
		expect(draft.url).toBe("https://a.com/x");
	});
});
