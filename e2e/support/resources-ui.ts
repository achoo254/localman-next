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

/** Generates data for every resource ("Sinh tất cả"), confirming if asked. */
export async function generateAll(page: Page): Promise<void> {
	await page.getByTestId("project-detail-generate-all").click();
	const confirm = page.getByTestId("modal-generate-all");
	await expect(
		confirm.or(page.getByText("Đã sinh dữ liệu")).first(),
	).toBeVisible();
	if (await confirm.isVisible()) {
		await confirm.getByRole("button", { name: "Sinh dữ liệu" }).click();
	}
	await expect(page.getByText("Đã sinh dữ liệu").first()).toBeVisible();
}

/** Mock URL of a resource's collection, as the name link of its card shows it. */
export async function mockUrlOf(page: Page, name: string): Promise<string> {
	const href = await nodeOf(page, name)
		.locator('[data-id$="-link"]')
		.getAttribute("href");
	if (!href) throw new Error(`No mock URL on the card of ${name}`);
	return href;
}
