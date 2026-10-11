/** A collection tree shared by the export tests. */
import type { CollectionTree } from "../import/imported-collection.js";
import {
	type ApiRequestDraft,
	createRequestDraft,
	emptyRequestBody,
} from "../request-model.js";

const row = (key: string, value: string, enabled = true) => ({
	id: key,
	key,
	value,
	enabled,
});

function request(id: string, name: string, draft: Partial<ApiRequestDraft>) {
	return {
		kind: "request" as const,
		id,
		name,
		description: "",
		draft: createRequestDraft({ name, ...draft }),
		examples: [],
	};
}

export const SHOP_TREE: CollectionTree = {
	name: "Shop",
	description: "Shop API",
	auth: { type: "bearer", token: "t" },
	variables: [{ key: "baseUrl", value: "https://api.example.com" }],
	scripts: { pre: "", post: "" },
	tags: [],
	status: null,
	items: [
		{
			kind: "folder",
			id: "f1",
			name: "users",
			description: "",
			auth: { type: "inherit" },
			scripts: { pre: "", post: "" },
			items: [
				request("r1", "Get user", {
					auth: { type: "inherit" },
					url: "{{baseUrl}}/users/{{id}}?expand=1",
					params: [row("expand", "1"), row("debug", "true", false)],
					headers: [
						row("X-Trace", "abc"),
						row("Content-Type", "application/json"),
					],
				}),
				request("r2", "Create user", {
					method: "POST",
					url: "{{baseUrl}}/users",
					headers: [
						row("Content-Type", "application/vnd.api+json; charset=utf-8"),
					],
					auth: { type: "apikey", key: "X-Key", value: "k", in: "header" },
					body: { ...emptyRequestBody(), type: "raw", raw: '{"name":"Ann"}' },
				}),
			],
		},
		request("r3", "Upload", {
			method: "PUT",
			url: "https://files.example.com/upload",
			auth: { type: "none" },
			body: {
				...emptyRequestBody(),
				type: "formdata",
				formData: [
					{ ...row("caption", "me"), kind: "text" },
					{ ...row("file", ""), kind: "file" },
				],
			},
		}),
		request("r4", "Duplicate", {
			auth: { type: "inherit" },
			url: "{{baseUrl}}/users/{{id}}",
		}),
	],
};
