import { describe, expect, it } from "vitest";
import type { CollectionTree } from "../import/imported-collection.js";
import { type KeyValueRow, createRequestDraft } from "../request-model.js";
import { publicCollectionTree } from "./public-collection.js";

const row = (key: string, value: string): KeyValueRow => ({
	id: `r-${key}`,
	key,
	value,
	enabled: true,
});

const sentWithToken = createRequestDraft({
	name: "Login",
	url: "https://ann:pw@api.test/login?api_key=sk_live_x&user={{userId}}",
	headers: [
		row("Authorization", "Bearer abc"),
		row("X-API-Key", "k1"),
		row("Cookie", "sid=1"),
		row("X-Trace", "{{token}}"),
		row("Accept", "application/json"),
	],
	auth: { type: "basic", username: "ann", password: "pw" },
});

const TREE: CollectionTree = {
	name: "Shop",
	description: "Shop API",
	auth: { type: "bearer", token: "root-token" },
	variables: [
		{ key: "baseUrl", value: "https://api.test" },
		{ key: "apiSecret", value: "s3cr3t", secret: true },
	],
	scripts: { pre: "", post: "" },
	tags: [],
	status: null,
	items: [
		{
			kind: "folder",
			id: "f1",
			name: "admin",
			description: "",
			auth: { type: "apikey", key: "X-Key", value: "folder-key", in: "header" },
			scripts: { pre: "", post: "" },
			items: [
				{
					kind: "request",
					id: "r1",
					name: "Login",
					description: "",
					draft: sentWithToken,
					examples: [
						{
							id: "e1",
							name: "200",
							request: sentWithToken,
							response: {
								status: 200,
								statusText: "OK",
								headers: [
									row("Set-Cookie", "sid=2; HttpOnly"),
									row("Content-Type", "application/json"),
								],
								body: '{"token":"live"}',
								bodyLanguage: "json",
							},
						},
					],
				},
				{
					kind: "request",
					id: "r2",
					name: "With refs",
					description: "",
					draft: createRequestDraft({
						url: "{{baseUrl}}/me",
						auth: { type: "bearer", token: "{{token}}" },
					}),
					examples: [],
				},
			],
		},
	],
};

const folder = () => {
	const first = publicCollectionTree(TREE).items[0];
	if (first?.kind !== "folder") throw new Error("expected a folder");
	return first;
};
const requestAt = (index: number) => {
	const item = folder().items[index];
	if (item?.kind !== "request") throw new Error("expected a request");
	return item;
};

describe("publicCollectionTree", () => {
	it("blanks auth typed in at the collection, folder and request", () => {
		const tree = publicCollectionTree(TREE);
		expect(tree.auth).toEqual({ type: "bearer", token: "" });
		expect(folder().auth).toMatchObject({ key: "X-Key", value: "" });
		expect(requestAt(0).draft.auth).toEqual({
			type: "basic",
			username: "ann",
			password: "",
		});
	});

	it("keeps {{var}} references in auth, headers and the URL", () => {
		expect(requestAt(1).draft.auth).toEqual({
			type: "bearer",
			token: "{{token}}",
		});
		expect(requestAt(0).draft.headers[3]?.value).toBe("{{token}}");
		expect(requestAt(0).draft.url).toContain("user={{userId}}");
	});

	it("blanks literal credential headers and query values, and drops userinfo", () => {
		const draft = requestAt(0).draft;
		expect(draft.headers.map((header) => header.value)).toEqual([
			"",
			"",
			"",
			"{{token}}",
			"application/json",
		]);
		expect(draft.url).toBe("https://api.test/login?api_key&user={{userId}}");
	});

	it("redacts the example's request, its Set-Cookie and drops its body", () => {
		const example = requestAt(0).examples[0];
		expect(example?.request.auth).toMatchObject({ password: "" });
		expect(example?.request.headers[0]?.value).toBe("");
		expect(example?.response.headers.map((header) => header.value)).toEqual([
			"",
			"application/json",
		]);
		expect(example?.response.body).toBe("");
		expect(example?.response.status).toBe(200);
	});

	it("blanks secret variables only", () => {
		expect(publicCollectionTree(TREE).variables).toEqual([
			{ key: "baseUrl", value: "https://api.test" },
			{ key: "apiSecret", value: "", secret: true },
		]);
	});

	it("leaves no typed credential anywhere in the payload", () => {
		const json = JSON.stringify(publicCollectionTree(TREE));
		for (const leaked of [
			"root-token",
			"folder-key",
			"Bearer abc",
			"sk_live_x",
			"s3cr3t",
			"sid=",
			"ann:pw",
			'"pw"',
			"live",
		]) {
			expect(json).not.toContain(leaked);
		}
		// The input is not changed.
		expect(TREE.auth).toEqual({ type: "bearer", token: "root-token" });
	});
});
