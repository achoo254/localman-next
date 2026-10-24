import { OperationError } from "@localman/operations";
import type { ClientResponse } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { maskError, maskResponse, maskSecrets } from "./secret-mask.js";

const response = (body: string, bodyEncoding: "utf8" | "base64" = "utf8") =>
	({
		status: 200,
		statusText: "OK",
		headers: [{ name: "X-Echo", value: "tok-123456" }],
		body,
		bodyEncoding,
		size: body.length,
		timings: { dns: null, connect: null, tls: null, ttfb: null, total: 1 },
		finalUrl: "https://api.test/?k=tok-123456",
		truncated: false,
	}) satisfies ClientResponse;

describe("secret masking", () => {
	it("masks every copy, the longest secret first", () => {
		expect(
			maskSecrets("a tok-123456 b tok-1234", ["tok-1234", "tok-123456"]),
		).toBe("a [secret] b [secret]");
	});

	it("leaves values too short to tell from ordinary text", () => {
		expect(maskSecrets("abc abc", ["abc"])).toBe("abc abc");
	});

	it("masks headers, text and binary bodies and the final URL", () => {
		const text = maskResponse(response("got tok-123456"), ["tok-123456"]);
		expect(JSON.stringify(text)).not.toContain("tok-123456");
		const bytes = Buffer.from("\u0000tok-123456\u0001").toString("base64");
		const binary = maskResponse(response(bytes, "base64"), ["tok-123456"]);
		expect(Buffer.from(binary.body, "base64").toString()).toBe(
			"\u0000[secret]\u0001",
		);
	});

	it("masks an error's message and text details", () => {
		const error = maskError(
			new OperationError(502, "PROXY_DNS_FAILED", "no tok-123456.test", {
				host: "tok-123456.test",
			}),
			["tok-123456"],
		);
		expect(error).toMatchObject({
			status: 502,
			code: "PROXY_DNS_FAILED",
			message: "no [secret].test",
			details: { host: "[secret].test" },
		});
	});
});
