import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { axeViolations } from "../support/axe.js";
import { WEB_ORIGIN } from "../support/ports.js";
import {
	seedSensitiveCollection,
	setSharing,
} from "../support/public-sharing-seed.js";
import {
	expectNoSecretsOn,
	openShareDialog,
	turnOnLink,
} from "../support/public-sharing-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * The owner turns a public link on from the Share dialog; a visitor
 * without a session reads requests and examples with every secret hidden;
 * the workspace Admin turns public links off and the page is gone.
 */
test("publish a collection with a public link and read it signed out", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("pub-owner", suffix));
	await openApiClient(page);
	const name = `Orders ${suffix}`;
	const { workspaceId } = await seedSensitiveCollection(page, name);
	await page.reload();
	await openShareDialog(page, name);
	const url = await turnOnLink(page, "public");

	// Every tab of the dialog fits a phone without scrolling the page sideways.
	await page.setViewportSize({ width: 375, height: 800 });
	for (const tab of ["people", "link", "public", "keys", "run"]) {
		await page.getByTestId(`share-tab-${tab}`).click();
		const overflow = await page.evaluate(
			() =>
				document.documentElement.scrollWidth -
				document.documentElement.clientWidth,
		);
		expect(overflow, `tab ${tab}`).toBeLessThanOrEqual(0);
	}

	const visitor = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const anon = await visitor.newPage();
		await anon.goto(new URL(url).pathname);
		await expect(anon.getByTestId("public-collection")).toBeVisible();
		await anon
			.getByTestId("public-tree-item")
			.filter({ hasText: "List orders" })
			.click();
		await expect(anon.getByTestId("public-request")).toBeVisible();
		await expect(anon.getByTestId("public-request-examples")).toContainText(
			"200",
		);
		await expectNoSecretsOn(anon);
		const serious = (await axeViolations(anon)).filter(
			(finding) =>
				finding.impact === "serious" || finding.impact === "critical",
		);
		expect(serious).toEqual([]);

		await setSharing(page, workspaceId, { publicLinksAllowed: false });
		await anon.reload();
		await expect(anon.getByTestId("public-view-not-found")).toBeVisible();
	} finally {
		await visitor.close();
	}
});
