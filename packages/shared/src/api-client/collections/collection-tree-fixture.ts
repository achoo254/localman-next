/** TEST ONLY. A tree with nested folders, examples, tags and a status. */
import type { CollectionTree } from "../import/imported-collection.js";
import { createRequestDraft, emptyRequestBody } from "../request-model.js";
import type { ExampleResponse } from "./collection-model.js";

const response = (status: number, body: string): ExampleResponse => ({
	status,
	statusText: status === 200 ? "OK" : "Not Found",
	headers: [
		{ id: "ct", key: "Content-Type", value: "application/json", enabled: true },
	],
	body,
	bodyLanguage: "json",
});

const getUser = createRequestDraft({
	name: "Get user",
	url: "{{baseUrl}}/users/1",
});

export const SHOP_TREE: CollectionTree = {
	name: "Shop",
	description: "Shop API",
	auth: { type: "bearer", token: "t" },
	variables: [{ key: "baseUrl", value: "https://api.example.com" }],
	scripts: { pre: "", post: "" },
	tags: ["shop", "v2"],
	status: { kind: "preset", preset: "stable" },
	items: [
		{
			kind: "folder",
			id: "f1",
			name: "users",
			description: "",
			auth: { type: "inherit" },
			scripts: { pre: "", post: "pm.test()" },
			items: [
				{
					kind: "request",
					id: "r1",
					name: "Get user",
					description: "One user",
					draft: getUser,
					examples: [
						{
							id: "e1",
							name: "200 OK",
							request: getUser,
							response: response(200, '{"id":1}'),
						},
						{
							id: "e2",
							name: "404",
							request: getUser,
							response: response(404, "{}"),
						},
					],
				},
				{
					kind: "request",
					id: "r2",
					name: "Create user",
					description: "",
					draft: createRequestDraft({
						name: "Create user",
						method: "POST",
						body: { ...emptyRequestBody(), type: "raw", raw: "{}" },
					}),
					examples: [],
				},
			],
		},
	],
};
