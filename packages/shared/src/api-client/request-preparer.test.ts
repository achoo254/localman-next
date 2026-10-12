import { describe, expect, it } from "vitest";
import {
	baseRequest,
	body,
	row,
	secretOptions,
} from "./request-preparer-test-utils.js";
import { prepareRequest } from "./request-preparer.js";

describe("request preparer (ported)", () => {
	it("builds URL and method for GET without body", () => {
		const out = prepareRequest(baseRequest({ url: "https://example.com" }));
		expect(out.method).toBe("GET");
		expect(out.url).toMatch(/^https:\/\/example\.com\/?$/);
		expect(out.body).toEqual({ kind: "none" });
	});

	it("fills `{{$random…}}` with the context's Faker runner, leaves it without", () => {
		const draft = baseRequest({
			url: "https://api.example.com/users/{{$randomUserName}}",
			headers: [row("X-Name", "{{$randomFirstName}}")],
		});
		const runFaker = (id: string) => id.replace(".", "-");
		const filled = prepareRequest(draft, {
			variables: { scopes: [], runFaker },
		});
		expect(filled.url).toBe("https://api.example.com/users/internet-userName");
		expect(filled.headers).toContainEqual({
			name: "X-Name",
			value: "name-firstName",
		});
		const typed = prepareRequest(draft, { variables: { scopes: [] } });
		expect(typed.headers).toContainEqual({
			name: "X-Name",
			value: "{{$randomFirstName}}",
		});
		expect(typed.unresolved).toEqual([]);
	});

	it("merges auth header for bearer", () => {
		const out = prepareRequest(
			baseRequest({ auth: { type: "bearer", token: "token123" } }),
		);
		expect(out.headers).toContainEqual({
			name: "Authorization",
			value: "Bearer token123",
		});
	});

	it("includes body and Content-Type for JSON", () => {
		const out = prepareRequest(
			baseRequest({
				method: "POST",
				body: body({ type: "raw", raw: '{"a":1}' }),
			}),
		);
		expect(out.body).toEqual({ kind: "text", text: '{"a":1}' });
		expect(out.headers).toContainEqual({
			name: "Content-Type",
			value: "application/json",
		});
	});
});

describe("request preparer", () => {
	it("keeps header order and repeated names, skips disabled rows", () => {
		const out = prepareRequest(
			baseRequest({
				headers: [
					row("X-A", "1"),
					row("Cookie", "a=1"),
					row("X-Off", "x", false),
					row("cookie", "b=2"),
					row("  ", "ignored"),
				],
			}),
		);
		expect(out.headers).toEqual([
			{ name: "X-A", value: "1" },
			{ name: "Cookie", value: "a=1" },
			{ name: "cookie", value: "b=2" },
		]);
	});

	it("auth replaces a same-named header typed by the user", () => {
		const out = prepareRequest(
			baseRequest({
				headers: [row("authorization", "old"), row("X-A", "1")],
				auth: { type: "bearer", token: "new" },
			}),
		);
		expect(out.headers).toEqual([
			{ name: "X-A", value: "1" },
			{ name: "Authorization", value: "Bearer new" },
		]);
	});

	it("puts an API key in the query after the params", () => {
		const out = prepareRequest(
			baseRequest({
				url: "https://x.test/a?q=1#f",
				params: [row("q", "1")],
				auth: { type: "apikey", key: "api_key", value: "k 1", in: "query" },
			}),
		);
		expect(out.url).toBe("https://x.test/a?q=1&api_key=k+1#f");
		expect(out.headers).toEqual([]);
	});

	it("uses the inherited auth", () => {
		const out = prepareRequest(baseRequest({ auth: { type: "inherit" } }), {
			inheritedAuth: { type: "basic", username: "u", password: "p" },
		});
		expect(out.headers).toEqual([
			{ name: "Authorization", value: "Basic dTpw" },
		]);
	});

	it("reports secrets used and unresolved names across fields", () => {
		const out = prepareRequest(
			baseRequest({
				url: "{{baseUrl}}/users/{{missing}}",
				params: [row("t", "{{token}}"), row("p", "{{pass}}", false)],
				auth: { type: "basic", username: "u", password: "{{pass}}" },
			}),
			secretOptions,
		);
		expect(out.url).toBe("https://api.example.com/users/{{missing}}?t=s3cret");
		expect(out.secretsUsed.sort()).toEqual(["pass", "token"]);
		expect(out.unresolved).toEqual(["missing"]);
	});

	it("reports no secret when the request carries none", () => {
		const out = prepareRequest(
			baseRequest({
				url: "{{baseUrl}}/a",
				headers: [row("X-Off", "{{token}}", false)],
			}),
			secretOptions,
		);
		expect(out.secretsUsed).toEqual([]);
	});

	it("adds http:// to a URL typed without scheme", () => {
		expect(prepareRequest(baseRequest({ url: "localhost:3000/a" })).url).toBe(
			"http://localhost:3000/a",
		);
	});
});
