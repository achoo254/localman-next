import { describe, expect, test } from "vitest";
import { html } from "../html.js";
import { LOCALES } from "../i18n/locale.js";
import { translator } from "../i18n/messages.js";
import { type LayoutOptions, renderLayout } from "../layout.js";

function render(options: Partial<LayoutOptions> = {}): string {
	return renderLayout({
		title: "Title",
		i18n: translator("en"),
		body: html`<section data-id="the-body">Body &amp; text</section>`,
		account: null,
		notice: null,
		...options,
	});
}

describe("console frame", () => {
	test("the page body sits in the shared shell's header, main and footer", () => {
		const page = render({ notice: "Sign-in failed" });
		expect(page).toContain('data-id="skip-link"');
		expect(page).toContain(
			'<a href="/" class="shell-brand" data-id="public-home"><img class="shell-brand-mark" src="/assets/img/tunelo-mark-128.webp" width="24" height="24" alt="" aria-hidden="true"/><b class="shell-brand-name">Tunelo</b></a>',
		);
		expect(page).toContain(
			'<main id="main" tabindex="-1" class="shell-main shell-container"><div class="page"><p class="notice" role="alert" data-id="page-notice">Sign-in failed</p><section data-id="the-body">Body &amp; text</section></div></main>',
		);
		expect(page).toContain('data-id="public-footer"');
		expect(page).toMatch(/data-id="theme-switch" data-domain="hoandat.com"/);
	});

	test("signed out: the sign-in pill goes to /auth/login", () => {
		expect(render()).toContain(
			'<a href="/auth/login" class="shell-topbar-link shell-topbar-cta" data-id="public-sign-in">Sign in</a>',
		);
	});

	test("signed in: who, then a sign-out form posting the CSRF token, no sign-in pill", () => {
		const page = render({
			account: { label: "Alice <a>", csrfToken: "token-1" },
		});
		expect(page).not.toContain('data-id="public-sign-in"');
		expect(page).toContain(
			'<form class="shell-topbar-form" data-id="topbar-sign-out-form" action="/auth/logout" method="post"><span class="topbar-user shell-hide-phone" data-id="topbar-user">Signed in as Alice &lt;a&gt;</span><input type="hidden" name="csrf" value="token-1"/><button type="submit" class="shell-topbar-link" data-id="topbar-sign-out">Sign out</button></form>',
		);
	});

	test.each(LOCALES)(
		"links every language in %s, the current one marked",
		(locale) => {
			const page = render({ i18n: translator(locale) });
			expect(page).toContain(`<html lang="${locale}">`);
			for (const option of LOCALES) {
				const query = new URLSearchParams({ set: option }).toString();
				const current = option === locale ? ' aria-current="true"' : "";
				expect(page).toContain(
					`data-id="lang-${option}" href="/lang?${query}" hrefLang="${option}"${current}>`,
				);
			}
		},
	);
});
