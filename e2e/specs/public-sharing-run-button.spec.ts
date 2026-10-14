import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { axeViolations } from "../support/axe.js";
import { WEB_ORIGIN } from "../support/ports.js";
import {
	SECRET_LITERALS,
	callApi,
	seedSensitiveCollection,
} from "../support/public-sharing-seed.js";
import {
	openShareDialog,
	prepareSignIn,
} from "../support/public-sharing-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * The owner creates a public Run button and copies its HTML; on a page
 * that embeds it a signed-out visitor clicks, signs in, picks a workspace
 * and imports without scripts; the copy holds no secret.
 */
test("import a collection through an embedded Run in Localman button", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("run-owner", suffix));
	await openApiClient(page);
	const name = `Catalog ${suffix}`;
	await seedSensitiveCollection(page, name);
	await page.reload();
	await openShareDialog(page, name);
	await page.getByTestId("share-tab-run").click();
	await page.getByTestId("share-run-visibility-public").click();
	await page.getByTestId("share-run-create").click();
	await page.getByTestId("share-run-confirm-confirm").click();
	const html = await page.getByTestId("share-run-html").first().innerText();
	expect(html).toContain("/run-button.svg");
	const badge = await page.request.get("/run-button.svg");
	expect(badge.headers()["content-type"]).toContain("image/svg+xml");

	const visitor = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const reader = await visitor.newPage();
		await reader.goto("/robots.txt");
		await reader.setContent(`<!doctype html><title>README</title>${html}`);
		await reader.getByRole("link", { name: "Run in Localman" }).click();
		await expect(reader.getByTestId("run-sign-in")).toBeVisible();
		const serious = (await axeViolations(reader)).filter(
			(finding) =>
				finding.impact === "serious" || finding.impact === "critical",
		);
		expect(serious).toEqual([]);

		await prepareSignIn(reader, uniqueUsername("runner", suffix));
		await reader.getByTestId("run-sign-in-login").click();
		await reader.waitForURL("**/run/**");
		await expect(reader.getByTestId("run-preview")).toBeVisible();
		await expect(reader.getByTestId("run-scripts")).toBeVisible();
		await expect(reader.getByTestId("run-include-scripts")).not.toBeChecked();
		await reader.getByTestId("run-import-submit").click();
		await expect(reader.getByTestId("run-import-done")).toBeVisible();
		const href = await reader
			.getByTestId("run-import-open")
			.getAttribute("href");
		const collectionId = href?.split("/").pop() ?? "";
		const copy = await callApi(reader, "GET", `/collections/${collectionId}`);
		expect(copy.scripts).toEqual({ pre: "", post: "" });
		const json = JSON.stringify(copy);
		for (const literal of SECRET_LITERALS) expect(json).not.toContain(literal);
	} finally {
		await visitor.close();
	}
});
