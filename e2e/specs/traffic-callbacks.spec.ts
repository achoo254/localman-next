import { expect, test } from "@playwright/test";
import { nodeOf } from "../support/resources-ui.js";
import { seedProjectWithUsers } from "../support/traffic-ui.js";

/** Link-local metadata address: the SSRF guard refuses it at once. */
const BLOCKED_TARGET = "https://169.254.169.254/";

test("a callback test to a blocked address is refused on its target field", async ({
	page,
}) => {
	await seedProjectWithUsers(page, "callbacks");

	await nodeOf(page, "users").locator('[data-id$="-edit"]').click();
	await expect(page.getByTestId("modal-edit-resource")).toBeVisible();

	await page.getByTestId("resource-form-callback-add").click();
	const callback = page.getByTestId("resource-form-callback-1");
	await expect(callback).toBeVisible();
	await callback
		.getByTestId("resource-form-callback-target")
		.fill(BLOCKED_TARGET);

	const tested = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			/\/callbacks\/test$/.test(new URL(response.url()).pathname),
	);
	await callback.getByTestId("resource-form-callback-test").click();
	const answer = await tested;
	expect(answer.status()).toBe(400);
	expect(await answer.json()).toMatchObject({
		error: {
			code: "CALLBACK_URL_BLOCKED",
			details: [{ path: "callback.target.url" }],
		},
	});

	// The refusal is shown on the target field itself, not as a result.
	const target = callback.getByTestId("resource-form-callback-target");
	await expect(target).toHaveAttribute("aria-invalid", "true");
	await expect(callback).toContainText("points to a private network");
	// Refused before any request left: the last-result line still says so.
	await expect(page.getByTestId("resource-form-callback-last")).toContainText(
		"Not sent yet.",
	);
});
