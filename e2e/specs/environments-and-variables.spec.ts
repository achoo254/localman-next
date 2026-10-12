import { type Page, expect, test } from "@playwright/test";
import {
	newRequestTab,
	openApiClient,
	prettyJsonBody,
	send,
	setUrl,
} from "../support/api-client-ui.js";
import { fetchFromPage, recordsOf } from "../support/mock-fetch.js";
import { createProject, openProject } from "../support/projects-ui.js";
import {
	createResource,
	generateAll,
	mockUrlOf,
} from "../support/resources-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

/** Adds an environment from the sidebar with one shared variable. */
async function addEnvironment(page: Page, key: string, value: string) {
	await page.getByTestId("environments-add").click();
	const editor = page.getByTestId("environment-editor");
	await expect(editor).toBeVisible();
	await editor.getByTestId("var-table-add").click();
	await editor.getByTestId("var-table-name").last().fill(key);
	await editor.getByTestId("var-table-shared").last().fill(value);
	await expect(editor.getByTestId("collection-save-state")).toHaveText(
		"All changes saved",
	);
	return editor;
}

test("a request uses the active environment's baseUrl and follows a switch", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("env-base", suffix));
	await createProject(page, `Env ${suffix}`);
	await openProject(page, `Env ${suffix}`);
	await createResource(page, "users");
	await generateAll(page);
	const usersUrl = await mockUrlOf(page, "users");
	const baseUrl = usersUrl.replace(/\/users$/, "");
	const expected = recordsOf(await fetchFromPage(page, usersUrl));

	await openApiClient(page);
	await page.getByTestId("sidebar-rail-environments").click();
	const staging = await addEnvironment(page, "baseUrl", baseUrl);
	await staging.getByTestId("environment-header-active").click();
	await expect(page.getByTestId("environment-selector")).toContainText(
		"New environment",
	);

	await newRequestTab(page);
	await setUrl(page, "{{baseUrl}}/users");
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");
	const body = await prettyJsonBody(page);
	expect(Array.isArray(body) ? body.length : -1).toBe(expected.length);

	// A second environment points elsewhere (the sidebar is still open);
	// switching makes the same tab follow.
	await addEnvironment(page, "baseUrl", `${baseUrl}/nowhere`);
	await page.getByTestId("environment-selector").click();
	await page.getByTestId("environment-selector-item").last().click();
	await page.getByTestId("tabbar-tab").first().click();
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("404");
});

test("a local value overrides the shared one for its owner only", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("env-local", suffix));
	await createProject(page, `Local ${suffix}`);
	await openProject(page, `Local ${suffix}`);
	await createResource(page, "users");
	const usersUrl = await mockUrlOf(page, "users");
	const baseUrl = usersUrl.replace(/\/users$/, "");

	await openApiClient(page);
	await page.getByTestId("sidebar-rail-environments").click();
	const editor = await addEnvironment(page, "baseUrl", `${baseUrl}/nowhere`);
	await editor.getByTestId("environment-header-active").click();
	await editor.getByTestId("var-table-value").last().fill(baseUrl);
	await expect(editor.getByTestId("var-table-status").last()).toHaveText(
		"Edited",
	);
	await expect(editor.getByTestId("collection-save-state")).toHaveText(
		"All changes saved",
	);

	await newRequestTab(page);
	await setUrl(page, "{{baseUrl}}/users");
	await send(page);
	await expect(page.getByTestId("response-status")).toContainText("200");
});
