import { type Page, expect } from "@playwright/test";
import { send } from "./api-client-ui.js";
import { ECHO_ORIGIN } from "./ports.js";
import { callApi } from "./public-sharing-seed.js";

/** A saved request of the seeded collection: its name, path and URL. */
export interface SeedRequest {
	readonly name: string;
	readonly url: string;
}

function row(key: string, value: string) {
	return { id: `r-${key}`, key, value, enabled: true };
}

/** A request draft with the shape the collection API stores (as the public sharing seed). */
function draftOf(request: SeedRequest) {
	return {
		name: request.name,
		method: "GET",
		url: request.url,
		params: [],
		headers: [row("Accept", "application/json")],
		auth: { type: "inherit" },
		body: {
			type: "none",
			rawLanguage: "json",
			raw: "",
			urlencoded: [],
			formData: [],
			binary: null,
		},
		scripts: { pre: "", post: "" },
		settings: {
			followRedirects: true,
			timeoutMs: 30_000,
			sendClientIp: true,
			route: "auto",
		},
	};
}

/** Saves a collection of plain requests in the caller's personal workspace. */
export async function seedCollection(
	page: Page,
	name: string,
	requests: readonly SeedRequest[],
): Promise<void> {
	const list: { items: { id: string; type: string }[] } = await callApi(
		page,
		"GET",
		"/workspaces",
	);
	const personal = list.items.find((item) => item.type === "personal");
	if (!personal) throw new Error("no personal workspace");
	await callApi(page, "POST", `/workspaces/${personal.id}/collections`, {
		tree: {
			name,
			description: "",
			auth: { type: "none" },
			variables: [],
			scripts: { pre: "", post: "" },
			tags: [],
			status: null,
			items: requests.map((request, index) => ({
				kind: "request",
				id: `req-${index}`,
				name: request.name,
				description: "",
				draft: draftOf(request),
				examples: [],
			})),
		},
	});
}

/** Opens a saved request from the sidebar tree of the collection `collection`. */
export async function openSaved(
	page: Page,
	collection: string,
	request: string,
): Promise<void> {
	const tree = page.getByTestId("sidebar-tree");
	await tree.getByText(collection, { exact: true }).click();
	await tree.getByText(request, { exact: true }).click();
	await expect(page.getByTestId("request-url")).not.toHaveValue("");
}

/**
 * Counts the browser's requests to the echo server by path, skipping
 * CORS preflights: the chain's real sends, nothing else.
 */
export function countEchoRequests(page: Page): Map<string, number> {
	const counts = new Map<string, number>();
	page.on("request", (request) => {
		if (!request.url().startsWith(ECHO_ORIGIN)) return;
		if (request.method() === "OPTIONS") return;
		const path = new URL(request.url()).pathname;
		counts.set(path, (counts.get(path) ?? 0) + 1);
	});
	return counts;
}

/** Sends the open request and waits for its own answer from the echo server. */
export async function sendAndWait(page: Page, path: string): Promise<void> {
	const answered = page.waitForResponse(
		(response) =>
			response.request().method() !== "OPTIONS" &&
			new URL(response.url()).pathname === path,
	);
	await send(page);
	expect((await answered).ok()).toBe(true);
}
