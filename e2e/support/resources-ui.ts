import { type Locator, type Page, expect } from "@playwright/test";

/** Card of the resource named `name` on the project's tree canvas. */
export function nodeOf(page: Page, name: string): Locator {
	return page.locator(`[data-id^="resource-node-"][data-name="${name}"]`);
}

/** Adds a root resource with the default schema through the form. */
export async function createResource(page: Page, name: string): Promise<void> {
	await page.getByTestId("project-detail-new-resource").click();
	await page.getByTestId("resource-form-name").locator("input").fill(name);
	await page.getByTestId("resource-form-submit").click();
	await expect(page.getByTestId("modal-new-resource")).toBeHidden();
	await expect(nodeOf(page, name)).toBeVisible();
}

/**
 * Nests `child` under `parent` with the tree's connectors: pick the child's
 * left connector, then press the parent's right connector.
 */
export async function nestUnder(
	page: Page,
	child: string,
	parent: string,
): Promise<void> {
	await nodeOf(page, child).locator('[data-id$="-select"]').click();
	await nodeOf(page, parent).locator('[data-id$="-nest"]').click();
}

/**
 * Generates data for every resource, confirming if asked, and waits for
 * the real (not dry-run) `generate_all` answer. Selectors are `data-id`
 * and the API response, so the flow works in every interface language.
 */
export async function generateAll(page: Page): Promise<void> {
	const generated = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			/\/generate_all$/.test(new URL(response.url()).pathname) &&
			!new URL(response.url()).searchParams.has("dryRun"),
	);
	await page.getByTestId("project-detail-generate-all").click();
	const confirm = page.getByTestId("modal-generate-all");
	const answer = await Promise.race([
		generated,
		// Never shown when no resource has data yet: the race then ends with
		// the answer, and this wait's eventual timeout must not surface.
		confirm
			.waitFor({ state: "visible" })
			.then(
				() => null,
				() => undefined,
			),
	]);
	if (answer === null || answer === undefined) {
		await page.getByTestId("modal-generate-all-confirm").click();
	}
	expect((answer ?? (await generated)).ok()).toBe(true);
	await expect(confirm).toBeHidden();
}

/** Mock URL of a resource's collection, as the name link of its card shows it. */
export async function mockUrlOf(page: Page, name: string): Promise<string> {
	const href = await nodeOf(page, name)
		.locator('[data-id$="-link"]')
		.getAttribute("href");
	if (!href) throw new Error(`No mock URL on the card of ${name}`);
	return href;
}
