import { createRequestDraft } from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { hasBlankedSecrets, redactDraft } from "./redact-draft";

const row = (key: string, value: string) => ({
	id: `r-${key}`,
	key,
	value,
	enabled: true,
});

describe("redactDraft", () => {
	it("blanks literal credentials of the Authorization tab", () => {
		expect(
			redactDraft(
				createRequestDraft({ auth: { type: "bearer", token: "t0k" } }),
			).auth,
		).toEqual({ type: "bearer", token: "" });
		expect(
			redactDraft(
				createRequestDraft({
					auth: { type: "basic", username: "ann", password: "pw" },
				}),
			).auth,
		).toEqual({ type: "basic", username: "ann", password: "" });
		expect(
			redactDraft(
				createRequestDraft({
					auth: { type: "apikey", key: "X-Key", value: "v", in: "header" },
				}),
			).auth,
		).toMatchObject({ key: "X-Key", value: "" });
	});

	it("blanks credential headers and query params, URL included, and keeps the rest", () => {
		const url = "https://api.test/x?page=2&access_token=abc&q=a+b";
		const draft = createRequestDraft({
			url,
			params: [row("page", "2"), row("access_token", "abc"), row("q", "a b")],
			headers: [
				row("Authorization", "Bearer abc"),
				row("Cookie", "sid=1"),
				row("X-API-Key", "sk_live"),
				row("Accept", "application/json"),
			],
		});
		const redacted = redactDraft(draft);
		expect(redacted.url).toBe("https://api.test/x?page=2&access_token&q=a+b");
		expect(redacted.params.map((param) => param.value)).toEqual([
			"2",
			"",
			"a b",
		]);
		expect(redacted.headers.map((header) => header.value)).toEqual([
			"",
			"",
			"",
			"application/json",
		]);
		// The open tab keeps its values.
		expect(draft.headers[0]?.value).toBe("Bearer abc");
	});

	it("keeps {{var}} references and returns the same draft when nothing is secret", () => {
		const withVars = createRequestDraft({
			url: "https://api.test/x?token={{token}}",
			params: [row("token", "{{token}}")],
			headers: [row("Authorization", "Bearer {{token}}")],
			auth: { type: "bearer", token: "{{token}}" },
		});
		expect(redactDraft(withVars)).toBe(withVars);
		const plain = createRequestDraft({ url: "https://api.test/?page=1" });
		expect(redactDraft(plain)).toBe(plain);
	});
});

describe("hasBlankedSecrets", () => {
	it("is true for a recorded request whose credentials were blanked", () => {
		const draft = createRequestDraft({
			headers: [row("X-API-Key", "sk_live")],
			auth: { type: "bearer", token: "t" },
		});
		expect(hasBlankedSecrets(draft)).toBe(false);
		expect(hasBlankedSecrets(redactDraft(draft))).toBe(true);
		expect(hasBlankedSecrets(createRequestDraft())).toBe(false);
	});
});
