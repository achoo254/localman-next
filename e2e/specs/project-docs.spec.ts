import { type Page, expect, test } from "@playwright/test";
import { MOCK_BASE_DOMAIN, WEB_ORIGIN } from "../support/ports.js";
import { createProject, openProject } from "../support/projects-ui.js";
import { createResource, mockUrlOf, nodeOf } from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** The editable schema field rows of the open resource form (the locked `id` row is not one). */
const schemaFieldRows = (page: Page) =>
	page.locator(
		'[data-id^="resource-form-field-"]:not([data-id$="-suggested"])',
	);

/**
 * The owner publishes a mock project's docs, a guest reads them, then the
 * owner adds a field to a resource: the public page shows it after a
 * reload, and never shows the mock URL (the docs print `{baseUrl}`).
 */
test("docs change as soon as the schema does", async ({ page, browser }) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("docs-owner", suffix));
	const project = `Shop ${suffix}`;
	await createProject(page, project);
	await openProject(page, project);
	await createResource(page, "users");
	const mockUrl = await mockUrlOf(page, "users");

	await page.getByTestId("project-detail-docs").click();
	await page.getByTestId("modal-project-docs-published").click();
	await expect(
		page.getByTestId("modal-project-docs-published"),
	).toHaveAttribute("aria-checked", "true");
	const url = await page.getByTestId("modal-project-docs-link").inputValue();
	expect(url).toContain("/p/");
	await page.keyboard.press("Escape");

	const newField = `nickname${suffix}`;
	const visitor = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const guest = await visitor.newPage();
		await guest.goto(new URL(url).pathname);
		const docs = guest.getByTestId("public-docs");
		await expect(docs).toBeVisible();
		const users = guest.getByTestId("public-docs-resource").filter({
			has: guest.getByRole("heading", { level: 2, name: "users", exact: true }),
		});
		await expect(users).toBeVisible();
		await expect(
			users.getByRole("cell", { name: newField, exact: true }),
		).toHaveCount(0);

		const printed = await docs.innerText();
		expect(printed).toContain("{baseUrl}");
		expect(printed).not.toContain(MOCK_BASE_DOMAIN);
		expect(printed).not.toContain(mockUrl);

		// The owner adds a field to the resource through its edit form.
		await nodeOf(page, "users").locator('[data-id$="-edit"]').click();
		await expect(page.getByTestId("modal-edit-resource")).toBeVisible();
		const before = await schemaFieldRows(page).count();
		await page.getByTestId("resource-form-add-field").click();
		await expect(schemaFieldRows(page)).toHaveCount(before + 1);
		await schemaFieldRows(page).last().locator("input").first().fill(newField);
		await page.getByTestId("resource-form-submit").click();
		await expect(page.getByTestId("modal-edit-resource")).toBeHidden();

		await guest.reload();
		await expect(
			guest
				.getByTestId("public-docs-resource")
				.filter({
					has: guest.getByRole("heading", {
						level: 2,
						name: "users",
						exact: true,
					}),
				})
				.getByRole("cell", { name: newField, exact: true }),
		).toBeVisible();
	} finally {
		await visitor.close();
	}
});
