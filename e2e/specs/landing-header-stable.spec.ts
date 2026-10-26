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
		const features = bar.getByTestId("topbar-features");
		const docs = bar.getByTestId("topbar-docs");
		// Session still loading: the page shows its sign-in pair, in `locale`.
		await expect(
			bar.getByRole("link", { name: SIGN_IN_LABEL[locale], exact: true }),
		).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		const before = {
			features: await leftEdge(features),
			docs: await leftEdge(docs),
		};

		release();
		await expect(bar.getByTestId("topbar-projects")).toBeVisible();
		await expect(bar.getByTestId("topbar-account")).toBeVisible();
		const after = {
			features: await leftEdge(features),
			docs: await leftEdge(docs),
		};

		console.log(
			`[${locale}] features link x: ${before.features} -> ${after.features}; docs link x: ${before.docs} -> ${after.docs}`,
		);
		expect(after).toEqual(before);
	});
}
