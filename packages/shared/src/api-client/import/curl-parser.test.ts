import { describe, expect, it } from "vitest";
import { type CurlImport, parseCurlCommand } from "./curl-parser.js";

function parse(text: string): CurlImport {
	const result = parseCurlCommand(text);
	if (!result.ok) throw new Error(`import failed: ${result.error.code}`);
	return result.value;
}

describe("parseCurlCommand: basics ported from the old client", () => {
	it("parses a simple GET", () => {
		const { draft } = parse("curl https://api.example.com/users");
		expect(draft.method).toBe("GET");
		expect(draft.url).toBe("https://api.example.com/users");
		expect(draft.headers).toEqual([]);
		expect(draft.body.type).toBe("none");
	});

	it("parses a POST with a JSON body", () => {
		const { draft } = parse(
			`curl -X POST -H "Content-Type: application/json" -d '{"key":"val"}' https://api.example.com`,
		);
		expect(draft.method).toBe("POST");
		expect(draft.url).toBe("https://api.example.com");
		expect(draft.body).toMatchObject({
			type: "raw",
			rawLanguage: "json",
			raw: '{"key":"val"}',
		});
		// The preparer adds the same Content-Type, so no header row is kept.
		expect(draft.headers).toEqual([]);
	});

	it("parses basic auth from -u", () => {
		const { draft } = parse("curl -u user:p:ss https://api.example.com");
		expect(draft.auth).toEqual({
			type: "basic",
			username: "user",
			password: "p:ss",
		});
	});

	it("defaults to POST when there is data", () => {
		const { draft } = parse('curl -d "foo=bar" https://api.example.com');
		expect(draft.method).toBe("POST");
		expect(draft.body.type).toBe("urlencoded");
		expect(draft.body.urlencoded.map((r) => [r.key, r.value])).toEqual([
			["foo", "bar"],
		]);
	});

	it("rejects text that is not a curl command or has no URL", () => {
		expect(parseCurlCommand("wget https://a.com")).toEqual({
			ok: false,
			error: { code: "INVALID_CURL", params: {} },
		});
		expect(parseCurlCommand("curl -X POST")).toMatchObject({
			ok: false,
			error: { code: "INVALID_CURL" },
		});
		expect(parseCurlCommand("   ")).toMatchObject({
			error: { code: "EMPTY_INPUT" },
		});
		expect(parseCurlCommand("curl 'https://a.com")).toMatchObject({
			error: { code: "UNTERMINATED_QUOTE" },
		});
	});
});

describe("parseCurlCommand: commands copied from tools", () => {
	it("reads 'Copy as cURL (bash)' with $'…' quoting", () => {
		const text = [
			"curl 'https://api.example.com/v1/items?q=a%20b' \\",
			"  -H 'accept: application/json' \\",
			"  -H 'authorization: Bearer eyJhbGci' \\",
			"  -H 'content-type: application/json' \\",
			`  --data-raw $'{"note":"it\\'s\\\\nfine"}' \\`,
			"  --compressed",
		].join("\n");
		const request = parse(text);
		expect(request.draft.method).toBe("POST");
		expect(request.draft.auth).toEqual({ type: "bearer", token: "eyJhbGci" });
		expect(request.draft.headers.map((h) => h.key)).toEqual(["accept"]);
		expect(JSON.parse(request.draft.body.raw)).toEqual({ note: "it's\nfine" });
		expect(request.draft.params.map((p) => [p.key, p.value])).toEqual([
			["q", "a b"],
		]);
	});

	it("reads 'Copy as cURL (cmd)'", () => {
		const text = [
			'curl ^"https://api.example.com/items^" ^',
			'  -H ^"accept: */*^" ^',
			'  --data-raw ^"^{^\\^"a^\\^":^\\^"x ^& y^\\^"^}^"',
		].join("\r\n");
		const request = parse(text);
		expect(request.draft.url).toBe("https://api.example.com/items");
		expect(request.draft.headers.map((h) => [h.key, h.value])).toEqual([
			["accept", "*/*"],
		]);
		expect(JSON.parse(request.draft.body.raw)).toEqual({ a: "x & y" });
	});

	it("reads a multi-line PowerShell curl.exe command", () => {
		const text = [
			"curl.exe -X DELETE `",
			"  -H 'X-Reason: it''s `$old' `",
			"  https://api.example.com/items/1",
		].join("\r\n");
		const request = parse(text);
		expect(request.draft.method).toBe("DELETE");
		expect(request.draft.headers.map((h) => h.value)).toEqual(["it's `$old"]);
	});
});
