import { expect, test } from "@playwright/test";
import { uniqueSuffix } from "../support/session.js";
import {
	expectSandboxedAnswer,
	openEndpointTab,
	seedProjectWithUsers,
} from "../support/traffic-ui.js";

test("a mock call shows up live, masks authorization and opens in the API Client", async ({
	page,
	request,
}) => {
	const { usersUrl } = await seedProjectWithUsers(page, "log");
	await openEndpointTab(page, "log");
	await expect(page.getByTestId("request-log-status")).toHaveAttribute(
		"data-state",
		"live",
	);
	await expect(page.getByTestId("request-log-empty")).toBeVisible();

	const token = `e2e-${uniqueSuffix()}-secret`;
	const reply = await request.get(usersUrl, {
		headers: { authorization: `Bearer ${token}` },
	});
	expect(reply.status()).toBe(200);
	expect(reply.headers()["x-localman-source"]).toBe("mock");
	expectSandboxedAnswer(reply.headers());

	// The row arrives over SSE: the table was already open when the call ran.
	const rows = page.getByTestId("request-log-row");
	await expect(rows).toHaveCount(1);
	const row = rows.first();
	await expect(row.getByTestId("request-log-path")).toHaveText("/users");
	await expect(row).toContainText("Mock");

	await row.getByTestId("request-log-path").click();
	const detail = page.getByTestId("request-log-detail");
	await expect(detail).toBeVisible();
	await expect(
		detail.getByTestId("request-log-header-authorization"),
	).toContainText("[redacted]");
	expect(await detail.innerText()).not.toContain(token);

	// The replay goes to the public mock URL. In this stack that host is on a
	// non-default port (localhost:4610), so the SSRF guard refuses it: the
	// answer is the replay failure, not a sent request (see the report).
	const replayed = page.waitForResponse(
		(response) =>
			response.request().method() === "POST" &&
			/\/request-logs\/[^/]+\/replay$/.test(new URL(response.url()).pathname),
	);
	await row.getByTestId("request-log-replay").click();
	const answer = await replayed;
	expect(answer.status()).toBe(502);
	expect(await answer.json()).toMatchObject({
		error: { code: "REPLAY_FAILED" },
	});
	// Exact text: for about a second the toast's screen reader announcement
	// holds the same words inside a longer string.
	await expect(
		page.getByText("Couldn't replay this request", { exact: true }),
	).toBeVisible();
	await expect(rows).toHaveCount(1);

	await row.getByTestId("request-log-open-client").click();
	await page.waitForURL("**/api-client**");
	await expect(page.getByTestId("request-url")).toHaveValue(usersUrl);
});
