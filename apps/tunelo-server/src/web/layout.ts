import { currentTenant } from "../tenancy/tunnel-tenant.js";
import { BRAND_ICON_LINKS } from "./brand-icons.js";
import { footLinks } from "./brand.js";
import { type HtmlValue, type SafeHtml, html } from "./html.js";
import { LOCALES, LOCALE_NAMES } from "./i18n/locale.js";
import type { Translator } from "./i18n/messages.js";

/** Path of the language switcher (see page-routes.ts). */
export const LANGUAGE_PATH = "/lang";
export const LOGIN_PATH = "/auth/login";
export const LOGOUT_PATH = "/auth/logout";

export interface SignedInChrome {
	/** Name or username from the ID token; `null` when it carried neither. */
	readonly label: string | null;
	readonly csrfToken: string;
}

export interface LayoutOptions {
	readonly title: string;
	readonly i18n: Translator;
	readonly body: HtmlValue;
	readonly account: SignedInChrome | null;
	/** One-off message (a failed sign-in, an expired form). */
	readonly notice: string | null;
}

/** The Tunelo mark, AI-drawn (static/img); decorative, the name follows it. */
export const BRAND_MARK_PATH = "/assets/img/tunelo-mark-128.webp";
const BRAND_MARK = html`<img class="brand-mark" src="${BRAND_MARK_PATH}" width="24" height="24" alt="">`;

/** Link preview picture (static/img), AI-drawn, 1200 × 630. */
export const OG_IMAGE_PATH = "/assets/img/og-image.jpg";

function accountActions(
	i18n: Translator,
	account: SignedInChrome | null,
): SafeHtml {
	if (!account) {
		return html`<a class="topbar-link topbar-cta" href="${LOGIN_PATH}" data-id="topbar-sign-in">${i18n.t("nav.signIn")}</a>`;
	}
	return html`${
		account.label
			? html`<span class="topbar-user hide-sm" data-id="topbar-user">${i18n.t("nav.account", { name: account.label })}</span>`
			: ""
	}<form class="inline-form" method="post" action="${LOGOUT_PATH}" data-id="topbar-sign-out-form">
<input type="hidden" name="csrf" value="${account.csrfToken}">
<button class="topbar-link" type="submit" data-id="topbar-sign-out">${i18n.t("nav.signOut")}</button>
</form>`;
}

/** Plain links, no script: each one sets the language cookie and comes back. */
function languageSwitcher(i18n: Translator): SafeHtml {
	return html`<nav class="lang-switch" aria-label="${i18n.t("nav.language")}" data-id="lang-switch">${LOCALES.map(
		(locale) =>
			html`<a class="lang-option" href="${LANGUAGE_PATH}?set=${locale}" lang="${locale}" hreflang="${locale}"${
				locale === i18n.locale ? html` aria-current="true"` : ""
			} data-id="lang-${locale}">${LOCALE_NAMES[locale]}</a>`,
	)}</nav>`;
}

/**
 * Under every page, as on the account app (auth-next layout.ts): the
 * language pill, then "An app from <domain>", and the privacy policy and
 * terms. Tunelo has none of its own: it is part of the Localman suite, so
 * they are Localman's.
 */
function pageFoot(i18n: Translator): SafeHtml {
	const { domain, localmanUrl } = footLinks();
	return html`<footer class="page-foot container">${languageSwitcher(i18n)}<p class="foot-links"><a class="foot-link" href="https://${domain}" data-id="foot-home">${i18n.t("footer.ecosystem", { domain })}</a><a class="foot-link" href="${localmanUrl}/privacy" data-id="foot-privacy">${i18n.t("footer.privacy")}</a><a class="foot-link" href="${localmanUrl}/terms" data-id="foot-terms">${i18n.t("footer.terms")}</a></p></footer>`;
}

/** Link previews: title, description and the share image by absolute URL. */
function shareTags(i18n: Translator, title: string): SafeHtml {
	const image = `https://${currentTenant().tunnelDomain}${OG_IMAGE_PATH}`;
	return html`<meta name="description" content="${i18n.t("meta.description")}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tunelo">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${i18n.t("meta.description")}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">`;
}

/**
 * Shared shell of every console page: token CSS, the Tunelo wordmark, the
 * account actions, the language switcher and no script at all.
 */
export function renderLayout(options: LayoutOptions): string {
	const { i18n } = options;
	const page = html`<!DOCTYPE html>
<html lang="${i18n.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>${options.title}</title>
${shareTags(i18n, options.title)}
${BRAND_ICON_LINKS}
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/web.css">
</head>
<body>
<header class="topbar"><div class="topbar-inner container">
<a class="brand" href="/" aria-label="${i18n.t("nav.home")}" data-id="topbar-brand">${BRAND_MARK}<b>Tunelo</b></a>
<nav class="topbar-actions" aria-label="${i18n.t("nav.accountNav")}">${accountActions(i18n, options.account)}</nav>
</div></header>
<main class="page container">
${options.notice ? html`<p class="notice" role="alert" data-id="page-notice">${options.notice}</p>` : ""}
${options.body}
</main>
${pageFoot(i18n)}
</body>
</html>`;
	return page.value;
}
