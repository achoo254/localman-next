import { describe, expect, it } from "vitest";
import { MAX_TIMEOUT_MS } from "./limits.js";
import { createRequestDraft, emptyRequestBody } from "./request-model.js";
import { apiRequestDraftSchema } from "./request-schema.js";

describe("request draft schema", () => {
	it("accepts a new draft and a full one", () => {
		expect(apiRequestDraftSchema.parse(createRequestDraft())).toEqual(
			createRequestDraft(),
		);
		const full = createRequestDraft({
			name: "Create order",
			method: "POST",
			url: "{{baseUrl}}/orders?x=1",
			params: [{ id: "p", key: "x", value: "1", enabled: true }],
			headers: [{ id: "h", key: "X-A", value: "{{token}}", enabled: false }],
			auth: { type: "apikey", key: "X-Api-Key", value: "{{k}}", in: "query" },
			body: {
				...emptyRequestBody(),
				type: "formdata",
				formData: [
					{
						id: "f",
						key: "doc",
						value: "",
						enabled: true,
						kind: "file",
						file: {
							fileId: "1",
							name: "a.pdf",
							contentType: "application/pdf",
							size: 9,
						},
					},
				],
			},
			scripts: { pre: "lm.variables.set('a', 1)", post: "" },
		});
		expect(apiRequestDraftSchema.parse(full)).toEqual(full);
	});

	it("strips unknown keys", () => {
		const parsed = apiRequestDraftSchema.parse({
			...createRequestDraft(),
			extra: "x",
		});
		expect(parsed).not.toHaveProperty("extra");
	});

	it.each([
		{ method: "TRACE" },
		{ auth: { type: "oauth2" } },
		{ auth: { type: "apikey", key: "k", value: "v", in: "cookie" } },
		{
			settings: {
				...createRequestDraft().settings,
				timeoutMs: MAX_TIMEOUT_MS + 1,
			},
		},
		{ settings: { ...createRequestDraft().settings, route: "tunnel" } },
		{ body: { ...emptyRequestBody(), type: "graphql" } },
	])("rejects %j", (overrides) => {
		const result = apiRequestDraftSchema.safeParse({
			...createRequestDraft(),
			...overrides,
		});
		expect(result.success).toBe(false);
	});
});
