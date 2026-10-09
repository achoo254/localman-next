import { type Locator, type Page, expect } from "@playwright/test";

/** Opens the API client workbench (the `apiClient` flag is on in the E2E build). */
export async function openApiClient(page: Page): Promise<void> {
	await page.goto("/api-client");
	await expect(page.getByTestId("workbench")).toBeVisible();
}

/** Opens a blank request tab, from the empty editor or the tab bar. */
export async function newRequestTab(page: Page): Promise<void> {
	const before = await page.getByTestId("tabbar-tab").count();
	await page
		.getByTestId("editor-empty-new")
		.or(page.getByTestId("tabbar-new"))
		.first()
		.click();
	await expect(page.getByTestId("tabbar-tab")).toHaveCount(before + 1);
}

/** Replaces the URL of the active tab; a pasted cURL command is not typed here. */
export async function setUrl(page: Page, url: string): Promise<void> {
	await page.getByTestId("request-url").fill(url);
}

/** Picks the route next to Send: "auto", "direct" or "proxy". */
export async function chooseRoute(
	page: Page,
	route: "auto" | "direct" | "proxy",
): Promise<void> {
	await page.getByTestId("request-route").selectOption(route);
}

/**
 * Pastes a cURL command into the URL field: a `paste` event built in the
 * page with `text/plain` data, the way the browser delivers a real paste.
 */
export async function pasteCurl(page: Page, command: string): Promise<void> {
	await page
		.getByTestId("request-url")
		.evaluate((input: HTMLElement, text: string) => {
			const transfer = new DataTransfer();
			transfer.setData("text/plain", text);
			input.dispatchEvent(
				new ClipboardEvent("paste", {
					clipboardData: transfer,
					bubbles: true,
					cancelable: true,
				}),
			);
		}, command);
}

/** Clicks Send; each spec asserts the outcome it expects (answer, panel or modal). */
export async function send(page: Page): Promise<void> {
	await page.getByTestId("request-send").click();
}

/** The request tab whose label contains `text`. */
export function tabNamed(page: Page, text: string): Locator {
	return page.getByTestId("tabbar-tab").filter({ hasText: text });
}

/** Parses the pretty JSON shown in the response body; throws when it is not JSON. */
export async function prettyJsonBody(page: Page): Promise<unknown> {
	const text = await page.getByTestId("response-body").first().innerText();
	return JSON.parse(text);
}

/** Shape of the echo server answer (`e2e/support/echo-server.ts`). */
export interface EchoAnswer {
	readonly method: string;
	readonly url: string;
	readonly headers: [string, string][];
	readonly body: string;
	readonly bodyBase64: string;
}

export function isEchoAnswer(value: unknown): value is EchoAnswer {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.method === "string" &&
		typeof candidate.url === "string" &&
		typeof candidate.body === "string" &&
		Array.isArray(candidate.headers)
	);
}

/** The echo answer shown in the response body of the active tab. */
export async function echoBody(page: Page): Promise<EchoAnswer> {
	const value = await prettyJsonBody(page);
	if (!isEchoAnswer(value)) {
		throw new Error(`Not an echo answer: ${JSON.stringify(value)}`);
	}
	return value;
}
