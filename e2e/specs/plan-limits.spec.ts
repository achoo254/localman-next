import { type Page, expect, test } from "@playwright/test";
import { createProject, projectLink } from "../support/projects-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";
import { endProPeriod } from "../support/user-plan.js";

/** Free allows three projects (packages/shared/src/plan-limits.ts). */
const FREE_PROJECTS = 3;

async function submitNewProject(page: Page, name: string): Promise<void> {
	await page.getByTestId("projects-add").click();
	await page.getByTestId("project-form-name").locator("input").fill(name);
	await page.getByTestId("project-form-submit").click();
}

test("a Free owner at the project limit is told the limit, never gets a fourth project", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	const names = Array.from(
		{ length: FREE_PROJECTS + 1 },
		(_, index) => `Plan ${index} ${suffix}`,
	);
	const username = uniqueUsername("limit", suffix);
	await signIn(page, username);
	// Sign-in started the automatic 30 days of Pro; end them to test Free.
	await endProPeriod(username);
	await page.reload();
	await createProject(page, names[0] ?? "");
	await createProject(page, names[1] ?? "");

	// This tab stays at two projects while the other tab adds the third.
	const stale = await page.context().newPage();
	await stale.goto("/projects");
	await expect(projectLink(stale, names[1] ?? "")).toBeVisible();

	await createProject(page, names[2] ?? "");

	// The client already counts three owned projects: the form never opens.
	const limitText = `You've reached the limit of ${FREE_PROJECTS} projects on this account.`;
	await page.getByTestId("projects-add").click();
	await expect(page.getByText(limitText)).toBeVisible();
	await expect(page.getByTestId("modal-new-project")).toHaveCount(0);
	await expect(page.getByTestId("modal-subscription")).toHaveCount(0);

	// The stale tab opens the form, and the server refuses with PLAN_LIMIT_REACHED.
	await submitNewProject(stale, names[3] ?? "");
	await expect(stale.getByText(limitText)).toBeVisible();

	await page.goto("/projects");
	await expect(page.locator('a[data-id$="-open"]')).toHaveCount(FREE_PROJECTS);
	await expect(projectLink(page, names[3] ?? "")).toHaveCount(0);
	await stale.close();
});
