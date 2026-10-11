/**
 * A tree using every field a collection stores, for the v2.1 round trip:
 * folders three levels deep, auth and scripts at every level, secret and
 * disabled variables, every body type (with content in inactive kinds),
 * disabled rows with descriptions, non-default settings, saved examples,
 * tags and a status. No picked files: only their names are exported.
 */
import type { CollectionTree } from "../import/imported-collection.js";
import { DEFAULT_REQUEST_SETTINGS } from "../request-model.js";
import {
	body,
	example,
	folder,
	request,
	row,
} from "./tree-builders-test-utils.js";

const deepest = folder(
	"Audit",
	{
		description: "Third level",
		auth: { type: "none" },
		scripts: { pre: "lm.variables.set('level', 3);", post: "" },
	},
	[
		request("Upload log", {
			method: "PUT",
			url: "{{baseUrl}}/admin/audit/log",
			body: body({ type: "binary" }),
			settings: { ...DEFAULT_REQUEST_SETTINGS, route: "direct" },
		}),
		request("Options", {
			method: "OPTIONS",
			url: "{{baseUrl}}/admin/audit",
			auth: { type: "bearer", token: "{{auditToken}}" },
		}),
	],
);

const admin = folder(
	"Admin",
	{
		description: "Second level, **Markdown**",
		auth: { type: "basic", username: "admin", password: "{{pass}}" },
		scripts: { pre: "", post: "lm.test('admin', () => {});" },
	},
	[
		request(
			"Create user",
			{
				method: "POST",
				url: "{{baseUrl}}/admin/users",
				headers: [row("Content-Type", "application/json")],
				body: body({
					type: "raw",
					rawLanguage: "json",
					raw: '{\n  "name": "Ann"\n}',
					urlencoded: [row("left", "over")],
				}),
				scripts: { pre: "const a = 1;\nconst b = 2;", post: "lm.done();" },
				settings: {
					followRedirects: false,
					timeoutMs: 5_000,
					sendClientIp: false,
					route: "proxy",
				},
			},
			{
				examples: [
					example(
						"Created as XML",
						{
							method: "POST",
							url: "{{baseUrl}}/admin/users",
							auth: { type: "inherit" },
							body: body({ type: "raw", rawLanguage: "xml", raw: "<a/>" }),
						},
						{ status: 201, statusText: "Created", body: "<user/>" },
					),
				],
			},
		),
		deepest,
	],
);

const LIST_EXAMPLES = [
	example(
		"Two users",
		{
			url: "{{baseUrl}}/users?page=1",
			params: [row("page", "1"), row("sort", "", { enabled: false })],
			headers: [row("Accept", "application/json")],
		},
		{
			headers: [
				row("Content-Type", "application/json"),
				row("X-Cache", "HIT", { enabled: false, description: "CDN" }),
			],
			body: '[{"id":1},{"id":2}]',
			bodyLanguage: "json",
		},
	),
	example(
		"Missing",
		{ url: "{{baseUrl}}/users?page=9", params: [row("page", "9")] },
		{
			status: 404,
			statusText: "Not Found",
			body: "no such page",
		},
	),
];

const users = folder(
	"Users",
	{
		description: "First level",
		scripts: { pre: "lm.variables.set('level', 1);", post: "" },
	},
	[
		request(
			"List users",
			{
				url: "{{baseUrl}}/users?page=1&sort=name",
				params: [
					row("page", "1", { description: "Page number" }),
					row("sort", "name"),
					row("debug", "true", { enabled: false, description: "Off" }),
				],
				headers: [
					row("Accept", "application/json"),
					row("X-Debug", "1", { enabled: false, description: "Tracing" }),
				],
			},
			{ description: "Lists users, paged.", examples: LIST_EXAMPLES },
		),
		admin,
		request("Login", {
			method: "POST",
			url: "{{baseUrl}}/login",
			auth: { type: "apikey", key: "api_key", value: "{{key}}", in: "query" },
			body: body({
				type: "urlencoded",
				urlencoded: [
					row("user", "ann"),
					row("otp", "", { enabled: false, description: "One-time" }),
				],
			}),
		}),
	],
);

export const RICH_TREE: CollectionTree = {
	name: "Round trip",
	description: "Every field Localman stores.",
	auth: { type: "apikey", key: "X-Api-Key", value: "{{apiKey}}", in: "header" },
	variables: [
		{ key: "baseUrl", value: "https://a.test", secret: false, enabled: true },
		{ key: "apiKey", value: "k-123", secret: true, enabled: true },
		{ key: "old", value: "1", secret: false, enabled: false },
	],
	scripts: { pre: "lm.variables.set('level', 0);", post: "lm.log('done');" },
	tags: ["billing", "v2"],
	status: { kind: "custom", name: "Beta test", emoji: "🚧" },
	items: [
		users,
		request("Avatar", {
			method: "PATCH",
			url: "https://files.example.com:8443/v1/avatar#top",
			auth: { type: "none" },
			body: body({
				type: "formdata",
				formData: [
					{ ...row("caption", "Me"), kind: "text" },
					{ ...row("file", ""), kind: "file" },
				],
				raw: "kept while form-data is sent",
				rawLanguage: "xml",
			}),
		}),
		request("Head", {
			method: "HEAD",
			url: "{{baseUrl}}/health",
			body: body({ urlencoded: [row("unused", "1")], rawLanguage: "html" }),
		}),
		request("Delete", { method: "DELETE", url: "{{baseUrl}}/users/1" }),
	],
};
