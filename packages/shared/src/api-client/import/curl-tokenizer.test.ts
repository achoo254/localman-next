import { describe, expect, it } from "vitest";
import { detectShellDialect, tokenizeCommand } from "./curl-tokenizer.js";
import { RequestImportFailure } from "./import-error.js";

const words = (text: string): string[] =>
	tokenizeCommand(text).map((word) => word.text);

describe("tokenizeCommand (POSIX)", () => {
	it("splits on whitespace", () => {
		expect(words("curl -X GET https://api.example.com")).toEqual([
			"curl",
			"-X",
			"GET",
			"https://api.example.com",
		]);
	});

	it("keeps a quoted header value as one word", () => {
		expect(
			words('curl -H "Content-Type: application/json" https://a.com'),
		).toEqual([
			"curl",
			"-H",
			"Content-Type: application/json",
			"https://a.com",
		]);
	});

	it("joins backslash line continuations", () => {
		expect(words("curl -X GET \\\n  https://api.example.com")).toEqual([
			"curl",
			"-X",
			"GET",
			"https://api.example.com",
		]);
		expect(words("curl \\\r\n https://a.com")).toEqual([
			"curl",
			"https://a.com",
		]);
	});

	it("joins adjacent quoted parts (the '\\'' idiom)", () => {
		expect(words("curl -d 'it'\\''s'")).toEqual(["curl", "-d", "it's"]);
		expect(words(`curl -d "a"'b'c`)).toEqual(["curl", "-d", "abc"]);
	});

	it("keeps single-quoted text literal", () => {
		expect(words(`echo '$HOME \\n "x"'`)).toEqual(["echo", '$HOME \\n "x"']);
	});

	it("applies only the double-quote escapes POSIX defines", () => {
		expect(words(`x "a\\"b \\$c \\\\ \\n"`)).toEqual(["x", 'a"b $c \\ \\n']);
	});

	it("decodes ANSI-C quoting", () => {
		expect(words("x $'a\\nb\\t\\'\\x41\\u00e9\\101'")).toEqual([
			"x",
			"a\nb\t'AéA",
		]);
	});

	it("skips comments at a word start", () => {
		expect(words("curl https://a.com # trailing note\n")).toEqual([
			"curl",
			"https://a.com",
		]);
		expect(words("curl https://a.com/#frag")).toEqual([
			"curl",
			"https://a.com/#frag",
		]);
	});

	it("marks quoted words so separators inside quotes stay data", () => {
		const tokens = tokenizeCommand("curl -d '|' | jq");
		expect(tokens.map((t) => [t.text, t.quoted])).toEqual([
			["curl", false],
			["-d", false],
			["|", true],
			["|", false],
			["jq", false],
		]);
	});

	it("rejects an unterminated quote", () => {
		expect(() => tokenizeCommand("curl -d 'abc")).toThrow(RequestImportFailure);
		expect(() => tokenizeCommand('curl -d "abc')).toThrow(RequestImportFailure);
		expect(() => tokenizeCommand("curl -d $'abc")).toThrow(
			RequestImportFailure,
		);
	});
});

describe("tokenizeCommand (Windows)", () => {
	it("detects the dialect", () => {
		expect(detectShellDialect("curl ^\n -H x")).toBe("cmd");
		expect(detectShellDialect('curl ^"https://a.com^"')).toBe("cmd");
		expect(detectShellDialect("curl.exe `\n -H x")).toBe("powershell");
		expect(detectShellDialect("curl -H x")).toBe("posix");
	});

	it("reads a Chrome 'Copy as cURL (cmd)' command", () => {
		const text = [
			'curl ^"https://api.example.com/items?a=1^&b=2^" ^',
			'  -H ^"content-type: application/json^" ^',
			'  --data-raw ^"^{^\\^"name^\\^":^\\^"it\'s 100^%^\\^"^}^"',
		].join("\r\n");
		expect(words(text)).toEqual([
			"curl",
			"https://api.example.com/items?a=1&b=2",
			"-H",
			"content-type: application/json",
			"--data-raw",
			'{"name":"it\'s 100%"}',
		]);
	});

	it("keeps a line break written as ^ followed by an empty line", () => {
		expect(words('curl --data-raw ^"a^\n\nb^"')).toEqual([
			"curl",
			"--data-raw",
			"a\nb",
		]);
	});

	it("splits arguments like the C runtime", () => {
		const text = 'curl -d "a\\"b" -d "c\\\\" x';
		expect(tokenizeCommand(text, "cmd").map((w) => w.text)).toEqual([
			"curl",
			"-d",
			'a"b',
			"-d",
			"c\\",
			"x",
		]);
	});

	it("reads PowerShell continuations and quoting", () => {
		const text = [
			"curl.exe -X POST `",
			"  -H 'X-Note: it''s $literal' `",
			'  -d "{`"a`":1}" https://a.com',
		].join("\n");
		expect(words(text)).toEqual([
			"curl.exe",
			"-X",
			"POST",
			"-H",
			"X-Note: it's $literal",
			"-d",
			'{"a":1}',
			"https://a.com",
		]);
	});

	it("rejects an unterminated PowerShell quote", () => {
		expect(() => tokenizeCommand("curl.exe `\n -d 'x", "powershell")).toThrow(
			RequestImportFailure,
		);
	});
});
