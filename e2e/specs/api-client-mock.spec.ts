import { expect, test } from "@playwright/test";
import {
	openApiClient,
	prettyJsonBody,
	send,
	tabNamed,
} from "../support/api-client-ui.js";
import { fetchFromPage, recordsOf } from "../support/mock-fetch.js";
import { createProject, openProject } from "../support/projects-ui.js";
import {
	createResource,
	generateAll,
	mockUrlOf,
} from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

test("Open in API Client sends a mock request and shows its JSON", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("mock-open", suffix));
	await createProject(page, `Mock ${suffix}`);
	await openProject(page, `Mock ${suffix}`);
	await createResource(page, "users");
	await generateAll(page);
	const usersUrl = await mockUrlOf(page, "users");
	const expected = recordsOf(await fetchFromPage(page, usersUrl));

	await page.getByTestId("project-detail-open-client").click();
	await page.waitForURL("**/api-client");
	await tabNamed(page, "users").first().click();
	await expect(page.getByTestId("request-url")).toHaveValue(usersUrl);
	await send(page);

	await expect(page.getByTestId("response-status")).toContainText("200");
	// The mock answers CORS, so the browser calls it straight through.
	await expect(page.getByTestId("response-route-badge")).toContainText(
		"Direct",
	);
	const body = await prettyJsonBody(page);
	expect(Array.isArray(body)).toBe(true);
	expect(Array.isArray(body) ? body.length : -1).toBe(expected.length);
});

test("From mock project opens the CRUD tabs and a POST creates a record", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("mock-crud", suffix));
	await createProject(page, `Crud ${suffix}`);
	await openProject(page, `Crud ${suffix}`);
	await createResource(page, "users");
	const usersUrl = await mockUrlOf(page, "users");
	const before = recordsOf(await fetchFromPage(page, usersUrl)).length;

	await openApiClient(page);
	await page.getByTestId("editor-empty-from-mock").click();
	const modal = page.getByTestId("modal-from-mock");
	await modal.getByRole("radio").first().check();
	await modal.getByTestId("modal-from-mock-submit").click();

	await tabNamed(page, "Create in users").first().click();
	await expect(page.getByTestId("request-url")).toHaveValue(usersUrl);
	await send(page);

	await expect(page.getByTestId("response-status")).toContainText("201");
	await expect(page.getByTestId("response-route-badge")).toContainText(
		"Direct",
	);
	const after = recordsOf(await fetchFromPage(page, usersUrl));
	expect(after).toHaveLength(before + 1);
});
