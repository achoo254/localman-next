import {
	type ApiRequestDraft,
	createRequestDraft,
	prepareRequest,
} from "@localman/shared/api-client";
import { describe, expect, it } from "vitest";
import { sensitiveParts } from "./sensitive-parts";

function partsOf(draft: ApiRequestDraft): string[] {
	return sensitiveParts(draft, prepareRequest(draft));
}

const header = (key: string, value: string) => ({
	id: key,
	key,
	value,
	enabled: true,
});

describe("sensitiveParts", () => {
	it("catches an X-API-Key typed in the Headers tab", () => {
		const draft = createRequestDraft({
			url: "https://api.test/x",
			headers: [header("X-API-Key", "sk_live_1"), header("Accept", "*/*")],
		});
		expect(partsOf(draft)).toEqual(["X-API-Key"]);
	});

	it("catches a token in the query", () => {
		const draft = createRequestDraft({
			url: "https://api.test/x?page=2&access_token=abc",
		});
		expect(partsOf(draft)).toEqual(["?access_token"]);
	});

	it("names the Authorization tab's credentials, an API key in the query included", () => {
		const bearer = createRequestDraft({
			url: "https://api.test/x",
			auth: { type: "bearer", token: "t" },
		});
		expect(partsOf(bearer)).toEqual(["Authorization"]);
		const apikey = createRequestDraft({
			url: "https://api.test/x",
			auth: { type: "apikey", key: "customer", value: "v", in: "query" },
		});
		expect(partsOf(apikey)).toEqual(["?customer"]);
	});

	it("ignores credential names left empty", () => {
		const draft = createRequestDraft({
			url: "https://api.test/x?token=",
			headers: [header("Authorization", "")],
		});
		expect(partsOf(draft)).toEqual([]);
	});

	it("names a vault secret copied into the request by another way", () => {
		// A script put the token's value in a plain header: no {{token}} left.
		const draft = createRequestDraft({
			url: "https://api.test/x",
			headers: [header("X-Trace", "vault-value-81c2")],
		});
		const vault = [
			{ name: "token", value: "vault-value-81c2" },
			{ name: "other", value: "not-in-request" },
		];
		expect(sensitiveParts(draft, prepareRequest(draft), vault)).toEqual([
			"{{token}}",
		]);
	});
});
