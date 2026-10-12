import { expect, test } from "@playwright/test";
import { openApiClient, send, setUrl } from "../support/api-client-ui.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import { signIn, uniqueUsername } from "../support/session.js";

/**
 * A collection from the REST CRUD template: rename a request, restore the
 * collection to how it was before from the changelog, then send the
 * request and keep its response as an example.
 */
test("restore a change from the changelog and save a response as an example", async ({
	page,
}) => {
	await signIn(page, uniqueUsername("changelog"));
	await openApiClient(page);
	await page.getByTestId("sidebar-collections-new").click();
	await page.getByTestId("new-menu-template").click();
	const tree = page.getByTestId("sidebar-tree");
	await tree.getByText("REST CRUD").click();
	await tree.getByText("Items", { exact: true }).click();
	await tree.getByText("List items").click();

	await page.getByTestId("request-name").fill("List all items");
	await page.getByTestId("request-head-save").click();
	await expect(tree.getByText("List all items")).toBeVisible();

	await page.getByTestId("right-rail-changelog").click();
	const changes = page.getByTestId("changelog-change");
	await expect(changes.first()).toBeVisible();
	// The oldest change is the collection being created from the template.
	await changes.last().getByTestId("changelog-restore").click();
	await page.getByTestId("modal-restore-change-confirm").click();
	await expect(tree.getByText("List items", { exact: true })).toBeVisible();
	await expect(tree.getByText("List all items")).toHaveCount(0);

	await tree.getByText("List items", { exact: true }).click();
	await setUrl(page, `${ECHO_ORIGIN}/cors/items`);
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");
	await page.getByTestId("response-save-example").click();
	await expect(tree.getByTestId("sidebar-tree-example")).toHaveCount(1);
});
