import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type Locator, type Page, expect, test } from "@playwright/test";
import { toRgbPng } from "../../scripts/brand/png-rgb.js";
import { createProject, openProject } from "../support/projects-ui.js";
import {
	createResource,
	generateAll,
	mockUrlOf,
	nestUnder,
} from "../support/resources-ui.js";
import { signIn } from "../support/session.js";
import { mockRootOf, openEndpointTab } from "../support/traffic-ui.js";

/*
 * Five store screenshots per display class, Vietnamese UI, light theme, on
 * demo data the spec builds itself: the mock API project, its Faker data,
 * the API client with a response, the live request log and a webhook inbox.
 * Run: `pnpm store:screenshots` (config: ./playwright.config.ts).
 */

const OUT = new URL("../../docs/store/screenshots/", import.meta.url);
const PROJECT = "Cửa hàng online";
const INBOX = "thanh-toan";
/** Mock host in production (MOCK_BASE_DOMAIN of infra/localman/.env.production.example). */
const PROD_MOCK_DOMAIN = "localman.hoandat.com";

/**
 * The E2E stack serves mocks at `http://{secret}.localhost:4610`; the app
 * shows `https://{secret}.localman.hoandat.com` in production. Only the
 * text on screen is rewritten, just before the shot, so the pictures show
 * what a store user sees; the API client badge says "(localhost)" only
 * because of that local host, so it loses the suffix too.
 */
async function showProductionHost(page: Page, secret: string): Promise<void> {
	await page.evaluate(
		({ secret, domain }) => {
			const fix = (text: string) =>
				text
					.replaceAll(`http://${secret}`, `https://${secret}`)
					.replaceAll(`${secret}.localhost:4610`, `${secret}.${domain}`)
					.replaceAll(".localhost:4610", `.${domain}`)
					.replace(/\s*\(localhost\)/i, "");
			const walker = document.createTreeWalker(
				document.body,
				NodeFilter.SHOW_TEXT,
			);
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				const text = node.textContent ?? "";
				const holder = node.parentElement?.parentElement?.textContent ?? "";
				// The endpoint line is split: "http://" | secret chip | ".localhost:4610/".
				if (text.trim() === "http://" && holder.includes(secret)) {
					node.textContent = text.replace("http://", "https://");
				} else if (text.includes("localhost")) {
					node.textContent = fix(text);
				}
			}
			for (const input of Array.from(document.querySelectorAll("input"))) {
				if (input.value.includes(secret)) input.value = fix(input.value);
			}
		},
		{ secret, domain: PROD_MOCK_DOMAIN },
	);
}

async function shoot(page: Page, secret: string, name: string): Promise<void> {
	await showProductionHost(page, secret);
	// The top bar is translucent with a backdrop blur headless Chromium does not
	// draw: opaque, so the page under it does not show through.
	await page.addStyleTag({
		content: "header { background-color: var(--c-bg) !important; }",
	});
	await page.evaluate(() => {
		if (document.activeElement instanceof HTMLElement)
			document.activeElement.blur();
	});
	await page.evaluate(() => document.fonts.ready);
	const shot = await page.screenshot({ animations: "disabled", caret: "hide" });
	const dir = new URL(`${test.info().project.name}/`, OUT);
	await mkdir(dir, { recursive: true });
	// App Store Connect refuses screenshots with an alpha channel.
	await writeFile(fileURLToPath(new URL(`${name}.png`, dir)), toRgbPng(shot));
}

/** Scrolls so `target` starts just under the top bar. */
async function scrollToTop(target: Locator): Promise<void> {
	await target.evaluate((el) => {
		const bar = document.querySelector("header");
		const offset = (bar?.getBoundingClientRect().bottom ?? 0) + 8;
		// Instant: the app scrolls smoothly, and a shot would catch it mid-way.
		window.scrollTo({
			top: el.getBoundingClientRect().top + window.scrollY - offset,
			behavior: "instant",
		});
	});
}

/** Reloads the project page: no toasts left from the setup. */
async function reloadProject(page: Page): Promise<void> {
	await page.reload();
	await expect(page.getByTestId("project-detail")).toBeVisible();
	await expect(page.getByTestId("project-detail-tree")).toBeVisible();
}

test("store screenshots", async ({ page, request }, info) => {
	await page.addInitScript(() => {
		window.localStorage.setItem("localman-locale", "vi");
		window.localStorage.setItem("localman-theme", "light");
	});
	// One account per display class: every run starts from an empty project list.
	await signIn(page, `minhanh_${info.project.name.replace(/\W/g, "")}`);
	await createProject(page, PROJECT);
	await openProject(page, PROJECT);
	for (const name of ["users", "orders", "products"])
		await createResource(page, name);
	await nestUnder(page, "orders", "users");
	await generateAll(page);
	const usersUrl = await mockUrlOf(page, "users");
	const secret = new URL(usersUrl).hostname.split(".")[0] ?? "";
	expect(secret).not.toBe("");

	await reloadProject(page);
	await shoot(page, secret, "01-mock-api");

	await page
		.locator(
			'[data-id^="resource-node-"][data-name="users"] [data-id$="-data"]',
		)
		.click();
	await expect(page.getByRole("dialog")).toContainText("users");
	await shoot(page, secret, "02-du-lieu-faker");

	// Traffic for the request log, as a frontend under development would send it.
	await request.get(usersUrl);
	await request.get(`${usersUrl}?page=1&limit=5`);
	await request.get(`${usersUrl}/1/orders`);
	await request.get(`${usersUrl}/999`);
	await request.post(usersUrl, { data: { name: "Nguyễn Minh Anh" } });
	await reloadProject(page);
	await openEndpointTab(page, "log");
	const rows = page.getByTestId("request-log-row");
	await expect(rows).toHaveCount(5);
	await scrollToTop(page.getByTestId("project-detail-endpoint"));
	await shoot(page, secret, "04-nhat-ky-request");

	await openEndpointTab(page, "inbox");
	await page.getByTestId("inbox-new").click();
	await page.getByTestId("inbox-form-name").fill(INBOX);
	await page.getByTestId("modal-submit").click();
	await expect(page.getByTestId(`inbox-item-${INBOX}`)).toBeVisible();
	const inboxUrl = `${mockRootOf(usersUrl)}/_inbox/${INBOX}`;
	for (const type of [
		"payment.created",
		"payment.succeeded",
		"refund.created",
	]) {
		await request.post(inboxUrl, {
			data: { type, amount: 250_000, currency: "VND" },
		});
	}
	// The inbox count is read when the list loads (traffic-inbox.spec.ts).
	await reloadProject(page);
	await openEndpointTab(page, "inbox");
	await expect(
		page.getByTestId(`inbox-item-${INBOX}`).getByTestId("inbox-item-view-log"),
	).toContainText("3");
	await scrollToTop(page.getByTestId("project-detail-endpoint"));
	await shoot(page, secret, "05-webhook-inbox");

	await page.getByTestId("project-detail-open-client").click();
	await page.waitForURL("**/api-client");
	await page
		.getByTestId("tabbar-tab")
		.filter({ hasText: "users" })
		.first()
		.click();
	await page.getByTestId("request-send").click();
	await expect(page.getByTestId("response-status")).toContainText("200");
	await shoot(page, secret, "03-api-client");
});
