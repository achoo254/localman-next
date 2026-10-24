import { expect, test } from "@playwright/test";
import { echoBody, openApiClient, send } from "../support/api-client-ui.js";
import { ECHO_ORIGIN } from "../support/ports.js";
import {
	countEchoRequests,
	openSaved,
	seedCollection,
	sendAndWait,
} from "../support/saved-requests-seed.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/**
 * `{{response "<name>" "<JSONPath>" [ttl]}}` chains requests: a request
 * that uses a response sends the source first when it has no fresh answer,
 * loops are an error, and the TTL decides when a source is sent again.
 */
test.describe("response references", () => {
	test("sending the last request of a chain sends its sources first", async ({
		page,
	}) => {
		const suffix = uniqueSuffix();
		await signIn(page, uniqueUsername("chain", suffix));
		const collection = `Chain ${suffix}`;
		await seedCollection(page, collection, [
			{ name: "A", url: `${ECHO_ORIGIN}/cors/a` },
			{
				name: "B",
				url: `${ECHO_ORIGIN}/cors/b?from={{response "A" "$.url"}}`,
			},
			{
				name: "C",
				url: `${ECHO_ORIGIN}/cors/c?from={{response "B" "$.url"}}`,
			},
		]);
		const counts = countEchoRequests(page);
		await openApiClient(page);
		await openSaved(page, collection, "C");

		await sendAndWait(page, "/cors/c");
		await expect(page.getByTestId("response-status")).toContainText("200");

		expect(Object.fromEntries(counts)).toEqual({
			"/cors/a": 1,
			"/cors/b": 1,
			"/cors/c": 1,
		});
		// C's URL carries B's URL, which carries A's: the chain reached the server.
		const echo = await echoBody(page);
		expect(decodeURIComponent(echo.url)).toContain("/cors/b?from=/cors/a");
	});

	test("a response is sent again only once its TTL has passed", async ({
		page,
	}) => {
		const suffix = uniqueSuffix();
		await signIn(page, uniqueUsername("ttl", suffix));
		const collection = `Ttl ${suffix}`;
		await seedCollection(page, collection, [
			{ name: "A", url: `${ECHO_ORIGIN}/cors/a` },
			{
				name: "B",
				url: `${ECHO_ORIGIN}/cors/b?from={{response "A" "$.url"}}`,
			},
			{
				name: "C",
				url: `${ECHO_ORIGIN}/cors/c?from={{response "B" "$.url" 1}}`,
			},
		]);
		const counts = countEchoRequests(page);
		await openApiClient(page);
		await openSaved(page, collection, "C");

		await sendAndWait(page, "/cors/c");
		// Within the 1 s TTL: B's kept answer serves the second send.
		await sendAndWait(page, "/cors/c");
		expect(counts.get("/cors/b")).toBe(1);

		// Past the TTL: B is sent again, A (default TTL 300 s) is not.
		await page.waitForTimeout(1_100);
		await sendAndWait(page, "/cors/c");
		expect(counts.get("/cors/b")).toBe(2);
		expect(counts.get("/cors/a")).toBe(1);
	});

	test("a loop between two requests shows an error and sends nothing", async ({
		page,
	}) => {
		const suffix = uniqueSuffix();
		await signIn(page, uniqueUsername("loop", suffix));
		const collection = `Loop ${suffix}`;
		await seedCollection(page, collection, [
			{
				name: "D",
				url: `${ECHO_ORIGIN}/cors/d?from={{response "E" "$.url"}}`,
			},
			{
				name: "E",
				url: `${ECHO_ORIGIN}/cors/e?from={{response "D" "$.url"}}`,
			},
		]);
		const counts = countEchoRequests(page);
		await openApiClient(page);
		await openSaved(page, collection, "D");

		await send(page);
		await expect(page.getByTestId("response-error")).toBeVisible();
		await expect(page.getByTestId("response-error-code")).toContainText(
			"REFERENCE_LOOP",
		);
		expect(counts.get("/cors/d") ?? 0).toBe(0);
		expect(counts.get("/cors/e") ?? 0).toBe(0);
	});
});
