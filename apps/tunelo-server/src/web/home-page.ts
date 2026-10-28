import { brandValues } from "./brand.js";
import { gettingStarted } from "./getting-started.js";
import { html } from "./html.js";
import type { Translator } from "./i18n/messages.js";
import { renderLayout, signInCard } from "./layout.js";

export interface HomePageOptions {
	readonly i18n: Translator;
	readonly tunnelDomain: string;
	readonly notice: string | null;
}

/** `/` signed out: what Tunelo is, the shared sign-in card, how to start. */
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
</section>
${signInCard(i18n, { title: i18n.t("home.signInTitle"), description: i18n.t("home.signInBody") })}
${gettingStarted(i18n)}`,
	});
}
