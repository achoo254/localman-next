import { expect, test } from "@playwright/test";
import {
	expectSandboxedAnswer,
	mockRootOf,
	openEndpointTab,
	seedProjectWithUsers,
	sourceOf,
} from "../support/traffic-ui.js";

/**
 * The upstream is a tunnel of the owner on port 4640, but no tunnel is
 * mapped to it, so the forwarded route gets the 502 with the hint. The
 * E2E stack cannot run a real upstream: the SSRF guard refuses the
 * loopback address a tunnel would resolve to. That success branch is
 * covered by the integration tests.
 */
test("an unmapped tunnel upstream answers 502 with the hint, and mock routes stay mock", async ({
	page,
	request,
}) => {
	const { usersUrl } = await seedProjectWithUsers(page, "upstream");
	await openEndpointTab(page, "upstream");

	await page.getByTestId("project-detail-upstream-tunnel").click();
	await page.getByTestId("project-detail-upstream-port").fill("4640");
	await page.getByTestId("project-detail-upstream-save").click();

	await expect(
		page.getByTestId("project-detail-upstream-current"),
	).toContainText("tunnel:4640");
	const status = page
		.getByTestId("project-detail-upstream-tunnel-status")
		.first();
	await expect(status).toHaveAttribute("data-state", "missing");
	await expect(page.getByTestId("project-detail-upstream")).toContainText(
		"tunelo http 4640",
	);

	const root = mockRootOf(usersUrl);
	const forwarded = await sourceOf(request, `${root}/orders`);
	expect(forwarded.status).toBe(502);
	expect(forwarded.source).toBe("upstream");
	expectSandboxedAnswer(forwarded.headers);
	// The body follows the API error envelope (`error.code`, `error.message`)
	// with the hint beside them. The phase text names a flat `error` string;
	// the shape is an open question (see the report).
	expect(forwarded.body).toMatchObject({
		error: { code: "UPSTREAM_UNAVAILABLE", hint: "tunelo http 4640" },
	});

	const answered = await sourceOf(request, usersUrl);
	expect(answered.status).toBe(200);
	expect(answered.source).toBe("mock");
	expectSandboxedAnswer(answered.headers);
});

test("a private upstream URL is refused when the upstream is saved", async ({
	page,
}) => {
	await seedProjectWithUsers(page, "upstream-ssrf");
	await openEndpointTab(page, "upstream");

	// The radio and the URL field share the `project-detail-upstream-url` id,
	// so the radio is picked by its role.
	await page.getByRole("radio", { name: /^URL/ }).check();
	await page
		.getByRole("textbox", { name: "Upstream URL" })
		.fill("https://127.0.0.1:4640");
	await page.getByTestId("project-detail-upstream-save").click();

	// The API's refusal lands on the URL field, not on the page-level alert.
	const field = page.getByRole("textbox", { name: "Upstream URL" });
	await expect(field).toHaveAttribute("aria-invalid", "true");
	await expect(
		page.getByRole("alert").filter({ hasText: "points to a private network" }),
	).toBeVisible();
	await expect(
		page.getByTestId("project-detail-upstream-current"),
	).toContainText("none");
});
