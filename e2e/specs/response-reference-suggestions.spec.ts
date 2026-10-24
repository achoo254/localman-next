import { expect, test } from "@playwright/test";
import { echoBody, openApiClient } from "../support/api-client-ui.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import {
	openSaved,
	seedCollection,
	sendAndWait,
} from "../support/saved-requests-seed.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * Typing `{{` in a saved request offers `{{response …}}` to the other
 * requests of its collection, with the keys and values of a response
 * already received: one pick chains two requests.
 */
test("a response reference is picked from the {{ suggestions and fills the request", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("ref-suggest", suffix));
	const collection = `Suggest ${suffix}`;
	await seedCollection(page, collection, [
		{ name: "A", url: `${ECHO_ORIGIN}/cors/a` },
		{ name: "B", url: `${ECHO_ORIGIN}/cors/b` },
	]);
	await openApiClient(page);

	// A's answer is kept, so its keys can be offered with their values.
	await openSaved(page, collection, "A");
	await sendAndWait(page, "/cors/a");

	// The collection is expanded already: clicking it again would fold it.
	await page
		.getByTestId("sidebar-tree")
		.getByText("B", { exact: true })
		.click();
	const url = page.getByTestId("request-url");
	await expect(url).toHaveValue(`${ECHO_ORIGIN}/cors/b`);
	await url.click();
	await url.press("End");
	await url.pressSequentially("?from={{res");
	const item = page
		.getByTestId("var-suggest-item")
		.filter({ hasText: 'response "A" "$.url"' });
	await expect(item).toContainText("/cors/a");
	await item.click();
	await expect(url).toHaveValue(
		`${ECHO_ORIGIN}/cors/b?from={{response "A" "$.url"}}`,
	);
	// Coloured as a reference in the URL (and in the query param it became).
	const marked = page.getByTestId("request").locator('[data-kind="reference"]');
	await expect(marked.first()).toHaveAttribute(
		"data-var",
		'response "A" "$.url"',
	);

	await sendAndWait(page, "/cors/b");
	expect(decodeURIComponent((await echoBody(page)).url)).toBe(
		"/cors/b?from=/cors/a",
	);
});
