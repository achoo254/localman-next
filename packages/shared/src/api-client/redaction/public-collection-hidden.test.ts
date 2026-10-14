import { describe, expect, it } from "vitest";
import type { CollectionTree } from "../import/imported-collection.js";
import {
	type ApiRequestDraft,
	type KeyValueRow,
	createRequestDraft,
	emptyRequestBody,
} from "../request-model.js";
import { publicCollectionTree } from "./public-collection.js";

const row = (key: string, value: string): KeyValueRow => ({
	id: `r-${key}`,
	key,
	value,
	enabled: true,
});

const TREE: CollectionTree = {
	name: "C",
	description: "",
	auth: { type: "none" },
	variables: [],
	scripts: { pre: "", post: "" },
	tags: [],
	status: null,
	items: [],
};

describe("publicCollectionTree on credentials hidden in other places", () => {
	const tree = (draft: ApiRequestDraft): CollectionTree => ({
		...TREE,
		items: [
			{
				kind: "request",
				id: "x",
				name: "X",
				description: "",
				draft,
				examples: [
					{
						id: "ex",
						name: "302",
						request: draft,
						response: {
							status: 302,
							statusText: "Found",
							headers: [
								row(
									"Location",
									"https://app.test/cb?access_token=loc-token&x=1",
								),
							],
							body: "",
							bodyLanguage: "json",
						},
					},
				],
			},
		],
	});
	const first = (draft: ApiRequestDraft) => {
		const item = publicCollectionTree(tree(draft)).items[0];
		if (item?.kind !== "request") throw new Error("expected a request");
		return item;
	};

	it("blanks credential-named form fields, keeps the others and files", () => {
		const out = first(
			createRequestDraft({
				body: {
					...emptyRequestBody(),
					type: "urlencoded",
					urlencoded: [
						row("client_secret", "cs-value"),
						row("grant_type", "x"),
					],
					formData: [
						{ ...row("password", "pw-value"), kind: "text" },
						{ ...row("avatar", ""), kind: "file" },
					],
				},
			}),
		);
		expect(out.draft.body.urlencoded.map((r) => r.value)).toEqual(["", "x"]);
		expect(out.draft.body.formData.map((r) => r.value)).toEqual(["", ""]);
	});

	it("blanks values typed next to a {{var}}, fragment pairs, userinfo and Location tokens", () => {
		const out = first(
			createRequestDraft({
				url: "user:pw-value@api.test/x#access_token=frag-token&state=1",
				headers: [
					row("Cookie", "session=cookie-value; tenant={{tenant}}"),
					row("X-Api-Key", "{{prefix}}key-value"),
				],
				auth: { type: "bearer", token: "sk_live_REAL{{suffix}}" },
			}),
		);
		expect(out.draft.url).toBe("api.test/x#access_token&state=1");
		expect(JSON.stringify(out)).not.toMatch(
			/pw-value|frag-token|cookie-value|key-value|sk_live_REAL|loc-token/,
		);
		expect(out.examples[0]?.response.headers[0]?.value).toBe(
			"https://app.test/cb?access_token&x=1",
		);
		for (const url of ["//u:p@h.test/x", "{{scheme}}://u:p@h.test/x"]) {
			expect(first(createRequestDraft({ url })).draft.url).not.toContain(
				"u:p@",
			);
		}
	});
});
