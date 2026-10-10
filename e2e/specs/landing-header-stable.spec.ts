import { type Locator, type Page, expect, test } from "@playwright/test";
import { signIn, uniqueUsername } from "../support/session.js";

/** `LOCALE_STORAGE_KEY` of apps/web/src/i18n/locale-preference.ts. */
const LOCALE_STORAGE_KEY = "localman-locale";

/** Labels of the sign-in link, to know the page shows a given language. */
const SIGN_IN_LABEL = { en: "Sign in", vi: "Đăng nhập" } as const;

async function leftEdge(target: Locator): Promise<number> {
	const box = await target.boundingBox();
	if (!box) throw new Error("the element has no box");
	return box.x;
}

/**
 * Holds `/users/me` until the returned function is called, so the test can
 * look at the top bar while the session is still loading.
 */
async function holdSession(page: Page): Promise<() => void> {
	let release: () => void = () => undefined;
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/api/v1/users/me", async (route) => {
		await held;
		await route.continue();
	});
	return release;
}

for (const locale of ["en", "vi"] as const) {
	test(`the top bar of / does not move when the session arrives (${locale})`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await signIn(page, uniqueUsername(`hdr_${locale}`));
		await page.evaluate(
			([key, value]) => window.localStorage.setItem(key, value),
			[LOCALE_STORAGE_KEY, locale],
		);
		const release = await holdSession(page);
		await page.goto("/");

		const bar = page.getByTestId("topbar");
		const language = bar.getByTestId("topbar-language");
		const pricing = bar.getByTestId("topbar-pricing");
		// Session still loading: the page shows its sign-in pair, in `locale`.
		await expect(
			bar.getByRole("link", { name: SIGN_IN_LABEL[locale], exact: true }),
		).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		const before = {
			language: await leftEdge(language),
			pricing: await leftEdge(pricing),
		};

		release();
		await expect(bar.getByTestId("topbar-projects")).toBeVisible();
		await expect(bar.getByTestId("topbar-account")).toBeVisible();
		const after = {
			language: await leftEdge(language),
			pricing: await leftEdge(pricing),
		};

		console.log(
			`[${locale}] language switch x: ${before.language} -> ${after.language}; pricing link x: ${before.pricing} -> ${after.pricing}`,
		);
		expect(after).toEqual(before);
	});
}
