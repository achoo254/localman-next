import { describe, expect, it } from "vitest";
import {
	authParts,
	basicCredentials,
	resolveEffectiveAuth,
} from "./auth-headers.js";
import { base64ToBytes } from "./byte-encoding.js";

describe("auth headers", () => {
	it("no auth adds nothing", () => {
		expect(authParts({ type: "none" })).toEqual({ headers: [], query: [] });
	});

	it("bearer adds a trimmed Authorization header", () => {
		expect(authParts({ type: "bearer", token: " abc " }).headers).toEqual([
			{ name: "Authorization", value: "Bearer abc" },
		]);
	});

	it("an empty bearer token adds nothing", () => {
		expect(authParts({ type: "bearer", token: "  " }).headers).toEqual([]);
	});

	it("basic encodes user:password in base64", () => {
		const { headers } = authParts({
			type: "basic",
			username: "aladdin",
			password: "opensesame",
		});
		expect(headers).toEqual([
			{ name: "Authorization", value: "Basic YWxhZGRpbjpvcGVuc2VzYW1l" },
		]);
	});

	it("basic encodes non-Latin-1 credentials as UTF-8", () => {
		const encoded = basicCredentials("đạt", "mật-khẩu 密码");
		const decoded = new TextDecoder().decode(base64ToBytes(encoded));
		expect(decoded).toBe("đạt:mật-khẩu 密码");
	});

	it("basic allows an empty password but needs a username", () => {
		expect(
			authParts({ type: "basic", username: "u", password: "" }).headers,
		).toEqual([{ name: "Authorization", value: "Basic dTo=" }]);
		expect(
			authParts({ type: "basic", username: " ", password: "p" }).headers,
		).toEqual([]);
	});

	it("API key goes to a header", () => {
		expect(
			authParts({
				type: "apikey",
				key: "X-Api-Key",
				value: "k1",
				in: "header",
			}),
		).toEqual({ headers: [{ name: "X-Api-Key", value: "k1" }], query: [] });
	});

	it("API key goes to the query", () => {
		expect(
			authParts({ type: "apikey", key: "api_key", value: "k1", in: "query" }),
		).toEqual({ headers: [], query: [{ key: "api_key", value: "k1" }] });
	});

	it("an API key without a name adds nothing", () => {
		expect(
			authParts({ type: "apikey", key: "", value: "k1", in: "header" }),
		).toEqual({ headers: [], query: [] });
	});

	it("fills variables in every field", () => {
		const fill = (text: string): string => text.replace("{{t}}", "T");
		expect(authParts({ type: "bearer", token: "{{t}}" }, fill).headers).toEqual(
			[{ name: "Authorization", value: "Bearer T" }],
		);
	});

	it("inherit takes the parent auth, or none without a parent", () => {
		const parent = { type: "bearer", token: "p" } as const;
		expect(resolveEffectiveAuth({ type: "inherit" }, parent)).toBe(parent);
		expect(resolveEffectiveAuth({ type: "inherit" })).toEqual({ type: "none" });
		expect(resolveEffectiveAuth({ type: "none" }, parent)).toEqual({
			type: "none",
		});
	});
});
