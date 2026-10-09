import { type Browser, type Page, expect, test } from "@playwright/test";
import { WEB_ORIGIN } from "../support/ports.js";
import {
	createProject,
	openProject,
	projectLink,
} from "../support/projects-ui.js";
import { createResource } from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** A signed-in user in a context of their own, on the web origin. */
async function userPage(
	browser: Browser,
	username: string,
): Promise<{ page: Page; close: () => Promise<void> }> {
	const context = await browser.newContext({ baseURL: WEB_ORIGIN });
	const page = await context.newPage();
	await signIn(page, username);
	return { page, close: () => context.close() };
}

test("an owner invites by username, a magic link admits a third user", async ({
	browser,
	page,
}) => {
	const suffix = uniqueSuffix();
	const projectName = `Team ${suffix}`;
	const bobName = uniqueUsername("bob", suffix);
	const carolName = uniqueUsername("carol", suffix);

	// Invitees need an account before the owner can find them by username.
	const bob = await userPage(browser, bobName);
	const carol = await userPage(browser, carolName);
	try {
		await signIn(page, uniqueUsername("owner", suffix));
		await createProject(page, projectName);
		await openProject(page, projectName);
		// An empty project opens its first-resource form after 500 ms and would
		// stack over the dialogs below, so the project gets a resource first.
		await createResource(page, "users");

		await page.getByTestId("project-detail-collaborators").click();
		await page.getByTestId("modal-collaborators-email").fill(`@${bobName}`);
		await page.getByTestId("modal-collaborators-invite").click();
		await expect(page.getByTestId(`invite-match-${bobName}`)).toBeVisible();
		await page.getByTestId("modal-collaborators-confirm").click();
		const inviteUrl = await page
			.getByTestId("modal-collaborators-link")
			.inputValue();
		await page.getByTestId("modal-collaborators-done").click();

		await bob.page.goto(inviteUrl);
		await bob.page.getByTestId("invite-page-accept").click();
		await expect(bob.page.getByTestId("project-detail")).toBeVisible();
		await bob.page.goto("/projects");
		await expect(projectLink(bob.page, projectName)).toBeVisible();

		await page.getByTestId("project-detail-magic-link").click();
		await page.getByTestId("modal-magic-link-create").click();
		const magicUrl = await page
			.getByTestId("modal-magic-link-input")
			.inputValue();
		await carol.page.goto(magicUrl);
		await carol.page.getByTestId("invite-page-accept").click();
		await expect(carol.page.getByTestId("project-detail")).toBeVisible();
		await carol.page.goto("/projects");
		await expect(projectLink(carol.page, projectName)).toBeVisible();
	} finally {
		await bob.close();
		await carol.close();
	}
});
