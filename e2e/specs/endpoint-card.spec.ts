import { type Page, expect, test } from "@playwright/test";
import { projectLink } from "../support/projects-ui.js";
import { signIn, uniqueSuffix, uniqueUsername } from "../support/session.js";

const TABS = ["rest", "mcp", "upstream", "log", "inbox"] as const;
const LONG_PREFIX = "/very/long/prefix/for/layout/checks/v2";

/** Creates a project through the dialog, with an API prefix when given. */
async function createProjectWith(
	page: Page,
	name: string,
	prefix = "",
): Promise<void> {
	await page.getByTestId("projects-add").click();
	await page.getByTestId("project-form-name").locator("input").fill(name);
	if (prefix) {
		await page.getByTestId("project-form-prefix").locator("input").fill(prefix);
	}
	await page.getByTestId("project-form-submit").click();
	await expect(page.getByTestId("modal-new-project")).toBeHidden();
	await expect(projectLink(page, name)).toBeVisible();
}

/** Opens the project from /projects and waits for its page. */
async function open(page: Page, name: string): Promise<void> {
	await projectLink(page, name).click();
	await expect(page.getByTestId("project-detail")).toBeVisible();
}

test("a new project offers its first resource once, and one tab panel shows at a time", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("tabs", suffix));
	const name = `Tabs ${suffix}`;
	await createProjectWith(page, name);

	// Right after creating it: "New resource" opens by itself, once.
	await open(page, name);
	const prompt = page.getByTestId("modal-new-resource");
	await expect(prompt).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(prompt).toBeHidden();
	await page.getByTestId("project-detail-back").click();
	await open(page, name);
	await page.waitForTimeout(1_500);
	await expect(prompt).toBeHidden();

	for (const tab of TABS) {
		await page.getByTestId(`project-detail-endpoint-tab-${tab}`).click();
		await expect(page.getByRole("tabpanel")).toHaveCount(1);
		if (tab === "mcp") {
			await expect(page.getByTestId("project-detail-mcp")).toBeVisible();
		} else {
			await expect(page.getByTestId("project-detail-mcp")).toBeHidden();
		}
	}
});

test("a long prefix wraps inside the card and the tab row hints at hidden tabs on a phone", async ({
	page,
}) => {
	const suffix = uniqueSuffix();
	await signIn(page, uniqueUsername("narrow", suffix));
	const name = `Narrow ${suffix}`;
	await createProjectWith(page, name, LONG_PREFIX);
	await page.setViewportSize({ width: 375, height: 812 });
	await open(page, name);
	const prompt = page.getByTestId("modal-new-resource");
	await expect(prompt).toBeVisible();
	await page.keyboard.press("Escape");
	await expect(prompt).toBeHidden();

	const card = await page.getByTestId("project-detail-endpoint").boundingBox();
	const prefix = page.getByTestId("project-detail-endpoint-prefix");
	await expect(prefix).toHaveText(LONG_PREFIX);
	const chip = await prefix.boundingBox();
	if (!card || !chip) throw new Error("The endpoint card is not laid out");
	expect(chip.x + chip.width).toBeLessThanOrEqual(card.x + card.width);

	const fade = page.getByTestId("project-detail-endpoint-tabs-fade");
	await expect(fade).toBeVisible();
	const inbox = page.getByTestId("project-detail-endpoint-tab-inbox");
	await inbox.click();
	// The chosen last tab scrolls fully into the row, and the fade goes.
	const row = await page.getByRole("tablist").boundingBox();
	const tab = await inbox.boundingBox();
	if (!row || !tab) throw new Error("The tab row is not laid out");
	expect(tab.x + tab.width).toBeLessThanOrEqual(row.x + row.width + 1);
	await expect(fade).toBeHidden();
});
