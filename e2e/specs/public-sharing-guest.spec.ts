import { expect, test } from "@playwright/test";
import { openApiClient } from "../support/api-client-ui.js";
import { axeViolations } from "../support/axe.js";
import { WEB_ORIGIN } from "../support/ports.js";
import {
	callApi,
	seedSensitiveCollection,
} from "../support/public-sharing-seed.js";
import { expectNoSecretsOn } from "../support/public-sharing-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

interface Notification {
	accessRequest?: { id: string; status: string };
}

/**
 * A second person opens a guest link: they see the redacted collection
 * and nothing more, ask for edit access, the owner approves, and only then
 * do they open the collection in its workspace.
 */
test("a guest reads the redacted collection, asks to edit and gets in once approved", async ({
	page,
	browser,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("guest-owner", suffix));
	await openApiClient(page);
	const { collectionId } = await seedSensitiveCollection(
		page,
		`Billing ${suffix}`,
		"team",
	);
	const enabled = await callApi(
		page,
		"POST",
		`/collections/${collectionId}/guest-link`,
	);
	const path = new URL(enabled.link.url).pathname;

	const other = await browser.newContext({ baseURL: WEB_ORIGIN });
	try {
		const guest = await other.newPage();
		await signIn(guest, uniqueUsername("guest", suffix));
		await guest.goto(path);
		await expect(guest.getByTestId("public-collection")).toBeVisible();
		await expectNoSecretsOn(guest);
		const serious = (await axeViolations(guest)).filter(
			(finding) =>
				finding.impact === "serious" || finding.impact === "critical",
		);
		expect(serious).toEqual([]);
		// Opening the link granted nothing.
		const before = await guest.request.get(
			`/api/v1/collections/${collectionId}`,
		);
		expect(before.status()).toBe(404);

		await guest.getByTestId("guest-request-edit").click();
		await guest.getByTestId("request-access-submit").click();
		await expect(guest.getByTestId("request-access-sent")).toBeVisible();

		const inbox: { items: Notification[] } = await callApi(
			page,
			"GET",
			"/notifications",
		);
		const request = inbox.items.find(
			(item) => item.accessRequest,
		)?.accessRequest;
		expect(request?.status).toBe("pending");
		await callApi(page, "POST", `/access-requests/${request?.id}/approve`, {
			role: "editor",
		});

		await guest.goto(path);
		await guest.getByTestId("guest-open-workspace").click();
		await guest.waitForURL("**/api-client**");
		const after = await guest.request.get(
			`/api/v1/collections/${collectionId}`,
		);
		expect(after.status()).toBe(200);
	} finally {
		await other.close();
	}
});
