import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { parseCurlCommand } from "../import/curl-parser.js";
import { tokenizeCommand } from "../import/curl-tokenizer.js";
import type { PreparedRequest } from "../request-preparer.js";
import { type SnippetTarget, generateSnippet } from "./snippet-registry.js";
import {
	HOSTILE_BODY,
	HOSTILE_HEADER,
	HOSTILE_PATCH,
	JSON_POST,
	preparedRequest,
} from "./snippet-test-fixtures.js";

const code = (target: SnippetTarget, request: PreparedRequest): string =>
	generateSnippet(target, request).code;

interface Captured {
	url: string;
	options: { method?: string; headers?: Record<string, string>; body?: string };
}

/** Runs a JavaScript snippet against a fake `fetch` / `axios`. */
async function runJs(snippet: string): Promise<Captured> {
	let captured: Captured | null = null;
	const fetch = async (url: string, options: Captured["options"] = {}) => {
		captured = { url, options };
		return { text: async () => "" };
	};
	const axios = async (
		config: Captured["options"] & { url: string; data?: string },
	) => {
		captured = { url: config.url, options: { ...config, body: config.data } };
		return { data: "" };
	};
	const source = snippet.replace("import axios from 'axios';", "");
	await runInNewContext(`(async () => {\n${source}\n})()`, {
		fetch,
		axios,
		console: { log: () => undefined },
	});
	if (captured === null) throw new Error("nothing sent");
	return captured;
}

describe("snippet escaping fixes", () => {
	it("cURL sends a body starting with @ as data, not a file", () => {
		const output = code(
			"curl",
			preparedRequest({ method: "POST", body: "@/etc/passwd" }),
		);
		expect(output).toContain("--data-raw '@/etc/passwd'");
		expect(output).not.toMatch(/(^|\s)-d\s/);
	});

	it("cURL imports back to the same request", () => {
		for (const request of [JSON_POST, HOSTILE_PATCH]) {
			const result = parseCurlCommand(code("curl", request));
			if (!result.ok) throw new Error(result.error.code);
			const { draft } = result.value;
			expect(draft.method).toBe(request.method);
			expect(draft.url).toBe(request.url);
			expect(draft.body.raw).toBe(
				request.body.kind === "text" ? request.body.text : "",
			);
		}
		const hostile = parseCurlCommand(code("curl", HOSTILE_PATCH));
		expect(hostile.ok && hostile.value.draft.headers[0]?.value).toBe(
			HOSTILE_HEADER,
		);
	});

	it("HTTPie pipes the body through printf '%s'", () => {
		const output = code("httpie", HOSTILE_PATCH);
		expect(output.startsWith("printf '%s' '")).toBe(true);
		const words = tokenizeCommand(output, "posix").map((w) => w.text);
		expect(words.slice(0, 3)).toEqual(["printf", "%s", HOSTILE_BODY]);
		expect(words.slice(4, 7)).toEqual(["http", "PATCH", HOSTILE_PATCH.url]);
		expect(words[7]).toBe(`X-Note:${HOSTILE_HEADER}`);
	});

	it("PowerShell keeps $ and backticks literal in headers and body", () => {
		const output = code("powershell", HOSTILE_PATCH);
		expect(output).toContain(
			`'X-Note' = 'it''s "q" $HOME \`id\` #{x} \\ ‘‘s’’ Tiếng Việt'`,
		);
		expect(output).toContain("ContentType = 'text/plain; charset=utf-8'");
		expect(output).toContain("Body = [System.Text.Encoding]::UTF8.GetBytes('");
		expect(output).not.toContain('\\"');
	});

	it("Kotlin and Dart escape $ in every string", () => {
		expect(code("kotlin-okhttp", HOSTILE_PATCH)).toContain(
			"\\$HOME \\${x} \\$(id)",
		);
		expect(code("dart-http", HOSTILE_PATCH)).toContain(
			"\\$HOME \\${x} \\$(id)",
		);
	});

	it("Ruby uses Ruby escapes in double quotes", () => {
		const output = code("ruby-net-http", HOSTILE_PATCH);
		expect(output).toContain("line1\\nline2");
		expect(output).toContain("\\#{x}");
		expect(output).toContain('request.add_field("X-Note", ');
	});

	it("Python encodes a non-ASCII body to UTF-8", () => {
		expect(code("python-requests", HOSTILE_PATCH)).toContain(
			".encode('utf-8')",
		);
		expect(code("python-requests", JSON_POST)).not.toContain(".encode(");
	});

	it("fetch and axios snippets send exactly the request", async () => {
		const fetched = await runJs(code("javascript-fetch", HOSTILE_PATCH));
		expect(fetched.url).toBe(HOSTILE_PATCH.url);
		expect(fetched.options.method).toBe("PATCH");
		expect(fetched.options.body).toBe(HOSTILE_BODY);
		expect(fetched.options.headers?.["X-Note"]).toBe(HOSTILE_HEADER);
		const posted = await runJs(code("javascript-axios", JSON_POST));
		expect(posted.options.headers?.["X-Tag"]).toBe("a, b");
		expect(posted.options.method).toBe("post");
	});

	it("OkHttp gets an empty body for a body-less POST and the media type from Content-Type", () => {
		const empty = preparedRequest({ method: "POST" });
		expect(code("java-okhttp", empty)).toContain(
			'.method("POST", RequestBody.create(new byte[0], null))',
		);
		expect(code("kotlin-okhttp", empty)).toContain(
			'.method("POST", ByteArray(0).toRequestBody())',
		);
		expect(code("java-okhttp", JSON_POST)).not.toContain(
			'.addHeader("Content-Type"',
		);
	});

	it("languages with list-based header APIs keep repeated headers", () => {
		for (const target of [
			"curl",
			"go-native",
			"java-okhttp",
			"csharp-httpclient",
			"rust-reqwest",
		] as const) {
			expect(code(target, JSON_POST).match(/X-Tag/g)).toHaveLength(2);
		}
	});
});
