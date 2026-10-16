import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { signIn, uniqueUsername } from "../support/session.js";

/**
 * Comments on a collection of the personal workspace: a thread on the
 * collection with a reply, a reaction, resolving and showing it again; an
 * inline comment on text selected in a saved request's URL. Watching is
 * offered only for team workspaces, so it shows disabled here.
 */
test("comment on a collection and inline on a request's URL", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("comments"));
	await openApiClient(page);
	await page.getByTestId("sidebar-collections-new").click();
	await page.getByTestId("new-menu-template").click();
	const tree = page.getByTestId("sidebar-tree");
	await tree.getByText("REST CRUD").click();
	await expect(page.getByTestId("collection-header-watch")).toBeDisabled();

	await page.getByTestId("right-rail-comments").click();
	const panel = page.getByTestId("comments-panel");
	await panel
		.getByTestId("comments-composer-input")
		.fill("Rename to **Shop**?");
	await panel.getByTestId("comments-composer-send").click();
	const thread = panel.getByTestId("comment-thread");
	await expect(thread.locator("strong")).toHaveText("Shop");
	await thread.getByTestId("comment-reply").click();
	await thread.getByTestId("comment-reply-input").fill("Agreed");
	await thread.getByTestId("comment-reply-send").click();
	await expect(thread.getByTestId("comment-item")).toHaveCount(2);
	await thread.getByTestId("comment-add-reaction").first().click();
	await page.getByTestId("reaction-option").first().click();
	await expect(thread.getByTestId("comment-reaction").first()).toHaveAttribute(
		"aria-pressed",
		"true",
	);
	await thread.getByTestId("comment-resolve").click();
	await expect(panel.getByTestId("comments-empty")).toBeVisible();
	await panel.getByTestId("comments-show-resolved").check();
	await expect(panel.getByTestId("comment-thread")).toHaveCount(1);

	await tree.getByText("Items", { exact: true }).click();
	await tree.getByText("List items").click();
	const url = page.getByTestId("request-url");
	const value = await url.inputValue();
	// Select the last five characters with the keyboard, as a person would.
	await url.click();
	await url.press("End");
	for (let i = 0; i < 5; i += 1) await url.press("Shift+ArrowLeft");
	const quote = value.slice(-5);
	await page.getByTestId("request-comment-selection").click();
	const dialog = page.getByTestId("modal-inline-comment");
	await expect(dialog.getByTestId("comment-anchor")).toContainText(quote);
	await dialog.getByTestId("modal-inline-comment-input").fill("Plural?");
	await dialog.getByTestId("modal-inline-comment-send").click();
	const inline = page
		.getByTestId("comments-panel")
		.getByTestId("comment-thread");
	await expect(inline.getByTestId("comment-anchor")).toContainText("URL");
	await expect(page.getByTestId("request-head-comments")).toContainText(
		"1 comment",
	);
});
