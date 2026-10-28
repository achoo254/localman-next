import { PublicPage } from "@achoo254/app-shell";
import { type ReactElement, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { currentTenant } from "../tenancy/tunnel-tenant.js";
import { APP_SHELL_PATH } from "./app-shell-assets.js";
import { BRAND_ICON_LINKS } from "./brand-icons.js";
import { footLinks } from "./brand.js";
import { type HtmlValue, SafeHtml, html } from "./html.js";
import { LOCALES, type Locale } from "./i18n/locale.js";
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

/** Link preview picture (static/img), AI-drawn, 1200 × 630. */
export const OG_IMAGE_PATH = "/assets/img/og-image.jpg";

/**
 * In place of the sign-in pill once signed in: who (from 480px up) and a
 * sign-out button posting the CSRF token, no script.
 */
function accountSlot(i18n: Translator, account: SignedInChrome): ReactElement {
	return createElement(
		"form",
		{
			className: "shell-topbar-form",
			method: "post",
			action: LOGOUT_PATH,
			"data-id": "topbar-sign-out-form",
		},
		account.label
			? createElement(
					"span",
					{
						className: "topbar-user shell-hide-phone",
						"data-id": "topbar-user",
					},
					i18n.t("nav.account", { name: account.label }),
				)
			: null,
		createElement("input", {
			type: "hidden",
			name: "csrf",
			value: account.csrfToken,
		}),
		createElement(
			"button",
			{
				type: "submit",
				className: "shell-topbar-link",
				"data-id": "topbar-sign-out",
			},
			i18n.t("nav.signOut"),
		),
	);
}

/**
 * Header, page frame and footer of the shared app shell
 * (@achoo254/app-shell), rendered here without client React: language
 * links to /lang, the theme switch run by app-shell-enhance.js, and the
 * privacy policy and terms of Localman, whose suite Tunelo belongs to.
 */
function shellPage(options: LayoutOptions): string {
	const { i18n, account } = options;
	const { domain, localmanUrl } = footLinks();
	const body = html`${
		options.notice
			? html`<p class="notice" role="alert" data-id="page-notice">${options.notice}</p>`
			: ""
	}${options.body}`;
	return renderToStaticMarkup(
		createElement(PublicPage<Locale>, {
			brand: { appName: "Tunelo", domain, markSrc: BRAND_MARK_PATH },
			locale: i18n.locale,
			locales: LOCALES,
			languageHref: (locale) =>
				`${LANGUAGE_PATH}?${new URLSearchParams({ set: locale }).toString()}`,
			signInHref: LOGIN_PATH,
			accountSlot: account ? accountSlot(i18n, account) : undefined,
			privacyHref: `${localmanUrl}/privacy`,
			termsHref: `${localmanUrl}/terms`,
			// biome-ignore lint/correctness/noChildrenProp: PublicPageProps requires children among the props
			children: createElement("div", {
				className: "page",
				// biome-ignore lint/security/noDangerouslySetInnerHtml: the body is SafeHtml, built by the escaping `html` template
				dangerouslySetInnerHTML: { __html: body.value },
			}),
		}),
	);
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
 * Every console page: the shell's theme script first (an external file
 * that applies the stored theme before the first paint; the CSP allows no
 * inline script), fonts, the shell's tokens and stylesheet, the console's
 * own CSS, then the page in the shared header, frame and footer.
 */
export function renderLayout(options: LayoutOptions): string {
	const { i18n } = options;
	// React escapes every value it renders, so its markup is safe as is.
	const shell = new SafeHtml(shellPage(options));
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
<script src="${APP_SHELL_PATH}/app-shell-enhance.js"></script>
<link rel="stylesheet" href="/assets/css/fonts.css">
<link rel="stylesheet" href="${APP_SHELL_PATH}/tokens.css">
<link rel="stylesheet" href="${APP_SHELL_PATH}/app-shell.css">
<link rel="stylesheet" href="/assets/css/web.css">
</head>
<body>
${shell}
</body>
</html>`;
	return page.value;
}
