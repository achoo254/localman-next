import { type Locator, type Page, expect } from "@playwright/test";

/** Link of the project row named `name` on /projects. */
export function projectLink(page: Page, name: string): Locator {
	return page.locator('a[data-id$="-open"]').filter({ hasText: name });
}

/** Creates a project through the "Project mới" dialog and waits for its row. */
export async function createProject(page: Page, name: string): Promise<void> {
	await page.getByTestId("projects-add").click();
	await page.getByTestId("project-form-name").locator("input").fill(name);
	await page.getByTestId("project-form-submit").click();
	await expect(page.getByTestId("modal-new-project")).toBeHidden();
	await expect(projectLink(page, name)).toBeVisible();
}

/** Opens the project named `name` from /projects. */
export async function openProject(page: Page, name: string): Promise<void> {
	await projectLink(page, name).click();
	await expect(page.getByTestId("project-detail")).toBeVisible();
}
