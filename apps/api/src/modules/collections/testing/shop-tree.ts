import type { CollectionTree } from "@localman/shared/api-client";
import { draftOf } from "./collection-fixture.js";

/** TEST ONLY. An imported tree: nested folders, inherited auth, scripts, variables. */
export const SHOP_TREE_FOR_TESTS: CollectionTree = {
	name: "Shop",
	description: "Shop API",
	auth: { type: "bearer", token: "{{token}}" },
	variables: [{ key: "baseUrl", value: "https://shop.example.com" }],
	scripts: { pre: "console.log('collection')", post: "" },
	tags: ["shop"],
	status: { kind: "custom", name: "Beta", emoji: "🧪" },
	items: [
		{
			kind: "folder",
			id: "users",
			name: "Users",
			description: "People",
			auth: { type: "inherit" },
			scripts: { pre: "", post: "console.log('folder')" },
			items: [
				{
					kind: "folder",
					id: "admins",
					name: "Admins",
					description: "",
					auth: { type: "basic", username: "root", password: "{{pw}}" },
					scripts: { pre: "", post: "" },
					items: [
						{
							kind: "request",
							id: "list-admins",
							name: "List admins",
							description: "",
							draft: draftOf("List admins", { auth: { type: "inherit" } }),
							examples: [],
						},
					],
				},
				{
					kind: "request",
					id: "get-user",
					name: "Get user",
					description: "One user",
					draft: draftOf("Get user"),
					examples: [
						{
							id: "ok",
							name: "200",
							request: draftOf("Get user"),
							response: {
								status: 200,
								statusText: "OK",
								headers: [],
								body: '{"id":1}',
								bodyLanguage: "json",
							},
						},
					],
				},
			],
		},
		{
			kind: "request",
			id: "health",
			name: "Health",
			description: "",
			draft: draftOf("Health", { method: "HEAD" }),
			examples: [],
		},
	],
};
