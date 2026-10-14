import { type Page, expect } from "@playwright/test";
import { WEB_ORIGIN } from "./ports.js";

/** Literals the public views must never show. */
export const SECRET_LITERALS = [
	"root-token-e2e",
	"secret-variable-e2e",
	"header-token-e2e",
	"basic-password-e2e",
	"response-body-e2e",
	"set-cookie-e2e",
];

const row = (key: string, value: string) => ({
	id: `r-${key}`,
	key,
	value,
	enabled: true,
});

const BODY = {
	type: "none",
	rawLanguage: "json",
	raw: "",
	urlencoded: [],
	formData: [],
	binary: null,
};
const SETTINGS = {
	followRedirects: true,
	timeoutMs: 30_000,
	sendClientIp: true,
	route: "auto",
};

function draft(name: string) {
	return {
		name,
		method: "GET",
		url: "https://api.example.test/orders?page=1",
		params: [row("page", "1")],
		headers: [
			row("Authorization", "Bearer header-token-e2e"),
			row("Accept", "application/json"),
		],
		auth: { type: "basic", username: "ann", password: "basic-password-e2e" },
		body: BODY,
		scripts: { pre: "", post: "" },
		settings: SETTINGS,
	};
}

/** A collection with a typed token, a secret variable and a saved example. */
export function sensitiveTree(name: string) {
	const request = draft("List orders");
	return {
		name,
		description: "Orders API",
		auth: { type: "bearer", token: "root-token-e2e" },
		variables: [
			{ key: "baseUrl", value: "https://api.example.test" },
			{ key: "apiSecret", value: "secret-variable-e2e", secret: true },
		],
		scripts: { pre: "console.log('pre')", post: "" },
		tags: [],
		status: null,
		items: [
			{
				kind: "request",
				id: "r1",
				name: "List orders",
				description: "",
				draft: request,
				examples: [
					{
						id: "e1",
						name: "200 OK",
						request,
						response: {
							status: 200,
							statusText: "OK",
							headers: [row("Set-Cookie", "sid=set-cookie-e2e")],
							body: '{"token":"response-body-e2e"}',
							bodyLanguage: "json",
						},
					},
				],
			},
		],
	};
}

/** Same-origin API call of the signed-in page (mutations carry the Origin). */
async function api(
	page: Page,
	method: "GET" | "POST" | "PATCH",
	path: string,
	data?: object,
) {
	const res = await page.request.fetch(`/api/v1${path}`, {
		method,
		headers: { origin: WEB_ORIGIN },
		...(data ? { data } : {}),
	});
	expect(res.ok(), `${method} ${path}: ${await res.text()}`).toBe(true);
	return res.json();
}

/** The caller's personal workspace (created on first use). */
async function personalWorkspace(page: Page): Promise<string> {
	const list: { items: { id: string; type: string }[] } = await api(
		page,
		"GET",
		"/workspaces",
	);
	const personal = list.items.find((item) => item.type === "personal");
	if (!personal) throw new Error("no personal workspace");
	return personal.id;
}

/**
 * The sensitive collection in the caller's personal workspace (what the
 * sidebar shows first) or in a new team workspace; returns their ids.
 */
export async function seedSensitiveCollection(
	page: Page,
	name: string,
	where: "personal" | "team" = "personal",
): Promise<{ workspaceId: string; collectionId: string }> {
	const workspaceId =
		where === "personal"
			? await personalWorkspace(page)
			: (await api(page, "POST", "/workspaces", { name: `Team ${name}` })).id;
	const collection = await api(
		page,
		"POST",
		`/workspaces/${workspaceId}/collections`,
		{ tree: sensitiveTree(name) },
	);
	return { workspaceId, collectionId: collection.id };
}

/** Same-origin API call as the signed-in page, for setup and checks. */
export const callApi = api;

/** Sets a workspace's public sharing switches as its Admin. */
export function setSharing(page: Page, workspaceId: string, body: object) {
	return api(page, "PATCH", `/workspaces/${workspaceId}/sharing`, body);
}
