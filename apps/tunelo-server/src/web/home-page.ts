import { brandValues } from "./brand.js";
import { gettingStarted } from "./getting-started.js";
import { html } from "./html.js";
import type { Translator } from "./i18n/messages.js";
import { LOGIN_PATH, renderLayout } from "./layout.js";

export interface HomePageOptions {
	readonly i18n: Translator;
	readonly tunnelDomain: string;
	readonly notice: string | null;
}

/** `/` signed out: what Tunelo is, how to start, and the sign-in button. */
export function renderHomePage(options: HomePageOptions): string {
	const { i18n } = options;
	return renderLayout({
		title: i18n.t("meta.homeTitle"),
		i18n,
		account: null,
		notice: options.notice,
		body: html`<section class="hero" data-id="home-hero">
<p class="eyebrow">${i18n.t("home.eyebrow")}</p>
<h1 class="hero-title">${i18n.t("home.title")}</h1>
<p class="lead">${i18n.t("home.lead", { domain: options.tunnelDomain, ...brandValues() })}</p>
<div class="hero-actions">
<a class="btn btn-primary btn-lg" href="${LOGIN_PATH}" data-id="home-sign-in">${i18n.t("home.cta", brandValues())}</a>
<p class="muted">${i18n.t("home.ctaHint", brandValues())}</p>
</div>
</section>
${gettingStarted(i18n)}`,
	});
}
