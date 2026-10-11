import {
	type ApiRequestDraft,
	type CollectionTree,
	type HttpMethod,
	createRequestDraft,
	emptyRequestBody,
} from "@localman/shared/api-client";

export const COLLECTION_TEMPLATES = ["rest-crud"] as const;
export type CollectionTemplate = (typeof COLLECTION_TEMPLATES)[number];

const ITEMS_URL = "{{baseUrl}}/items";
const ITEM_URL = `${ITEMS_URL}/{{itemId}}`;
const JSON_HEADER = {
	id: "content-type",
	key: "Content-Type",
	value: "application/json",
	enabled: true,
};

function jsonBody(raw: string): ApiRequestDraft["body"] {
	return { ...emptyRequestBody(), type: "raw", rawLanguage: "json", raw };
}

function request(
	id: string,
	name: string,
	method: HttpMethod,
	url: string,
	raw?: string,
) {
	const withBody = raw !== undefined;
	return {
		kind: "request" as const,
		id,
		name,
		description: "",
		draft: createRequestDraft({
			name,
			method,
			url,
			auth: { type: "inherit" },
			headers: withBody ? [JSON_HEADER] : [],
			body: withBody ? jsonBody(raw) : emptyRequestBody(),
		}),
		examples: [],
	};
}

/**
 * "REST CRUD": one folder with list, get, create, update and delete of
 * `{{baseUrl}}/items`, and the `baseUrl` and `itemId` variables to point
 * it at a real API.
 */
export function restCrudTemplate(name = "REST CRUD"): CollectionTree {
	const item = '{\n  "name": "Example item"\n}';
	return {
		name,
		description: "Create, read, update and delete items of a REST API.",
		auth: { type: "none" },
		variables: [
			{ key: "baseUrl", value: "https://api.example.com" },
			{ key: "itemId", value: "1" },
		],
		scripts: { pre: "", post: "" },
		tags: [],
		status: null,
		items: [
			{
				kind: "folder",
				id: "items",
				name: "Items",
				description: "",
				auth: { type: "inherit" },
				scripts: { pre: "", post: "" },
				items: [
					request("list", "List items", "GET", ITEMS_URL),
					request("get", "Get item", "GET", ITEM_URL),
					request("create", "Create item", "POST", ITEMS_URL, item),
					request("update", "Update item", "PUT", ITEM_URL, item),
					request("delete", "Delete item", "DELETE", ITEM_URL),
				],
			},
		],
	};
}
