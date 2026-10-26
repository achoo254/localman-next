import { BRAND_ICON_LINKS } from "./brand-icons.js";
import { brandValues } from "./brand.js";
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
const BRAND_MARK = html`<img class="brand-mark" src="${BRAND_MARK_PATH}" width="28" height="28" alt="">`;

function accountActions(
	i18n: Translator,
	account: SignedInChrome | null,
): SafeHtml {
	if (!account) {
		return html`<a class="btn btn-primary" href="${LOGIN_PATH}" data-id="topbar-sign-in">${i18n.t("nav.signIn")}</a>`;
	}
	return html`${
		account.label
			? html`<span class="topbar-user hide-sm" data-id="topbar-user">${i18n.t("nav.account", { name: account.label })}</span>`
			: ""
	}<form class="inline-form" method="post" action="${LOGOUT_PATH}" data-id="topbar-sign-out-form">
<input type="hidden" name="csrf" value="${account.csrfToken}">
<button class="btn btn-ghost" type="submit" data-id="topbar-sign-out">${i18n.t("nav.signOut")}</button>
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
${BRAND_ICON_LINKS}
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/web.css">
</head>
<body>
<header class="topbar"><div class="topbar-inner container">
<a class="brand" href="/" aria-label="${i18n.t("nav.home")}" data-id="topbar-brand">${BRAND_MARK}<span>Tunelo</span></a>
<div class="topbar-actions">${accountActions(i18n, options.account)}</div>
</div></header>
<main class="page container">
${options.notice ? html`<p class="notice" role="alert" data-id="page-notice">${options.notice}</p>` : ""}
${options.body}
</main>
<footer class="page-foot container">${languageSwitcher(i18n)}<p class="muted">${i18n.t("footer.note", brandValues())}</p></footer>
</body>
</html>`;
	return page.value;
}
