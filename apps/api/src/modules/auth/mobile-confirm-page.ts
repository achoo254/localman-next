import { randomBytes } from "node:crypto";
import type { Locale } from "@localman/shared";
import { brand } from "@localman/shared/brand";
import type { Response } from "express";
import { messagesFor } from "../../i18n/server-messages.js";
import { AUTH_PATHS } from "../../operations/protocol-routes.js";

const ESCAPES: Readonly<Record<string, string>> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/**
 * System colours only (`Canvas`, `ButtonFace`…): the page follows the
 * device's light or dark theme and carries no colour of its own.
 */
const STYLE = [
	":root{color-scheme:light dark;font-family:system-ui,sans-serif}",
	"body{margin:0;min-height:100vh;display:grid;place-items:center;background:Canvas;color:CanvasText}",
	"main{max-width:28rem;padding:1.5rem;display:grid;gap:1rem}",
	"h1{font-size:1.25rem;margin:0}p{margin:0;line-height:1.5}",
	".actions{display:flex;gap:0.75rem}",
	"button,a.button{font:inherit;padding:0.75rem 1.25rem;border-radius:0.5rem;border:1px solid ButtonBorder;background:ButtonFace;color:ButtonText;text-decoration:none}",
	"button[value=continue]{font-weight:600}",
].join("");

/**
 * Sends a page of the mobile sign-in. Its own CSP: no script at all, the
 * one inline style by nonce, forms only to this origin, never framed; no
 * referrer, so the callback URL (with its code) never leaks onwards.
 */
function sendPage(res: Response, locale: Locale, title: string, body: string) {
	const nonce = randomBytes(16).toString("base64");
	res.set({
		"Content-Security-Policy": `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`,
		"X-Frame-Options": "DENY",
		"Referrer-Policy": "no-referrer",
		"Cache-Control": "no-store",
	});
	res
		.type("html")
		.send(
			`<!doctype html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title><style nonce="${nonce}">${STYLE}</style></head><body><main>${body}</main></body></html>`,
		);
}

/** "Open the app on this phone as <account>?" with Continue and Cancel. */
export function sendConfirmPage(
	res: Response,
	options: {
		readonly locale: Locale;
		readonly account: string;
		readonly code: string;
	},
): void {
	const texts = messagesFor(options.locale).mobileSignIn;
	const app = brand.appName;
	const title = texts.confirmTitle({ app });
	const code = escapeHtml(options.code);
	sendPage(
		res,
		options.locale,
		title,
		`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(texts.confirmBody({ app, account: options.account }))}</p><p>${escapeHtml(texts.confirmHint)}</p><form method="post" action="${AUTH_PATHS.mobileConfirm}" class="actions"><input type="hidden" name="code" value="${code}"><button type="submit" name="action" value="continue">${escapeHtml(texts.continue)}</button><button type="submit" name="action" value="cancel">${escapeHtml(texts.cancel)}</button></form>`,
	);
}

/** A confirmation sent too late or twice. */
export function sendExpiredPage(res: Response, locale: Locale): void {
	const texts = messagesFor(locale).mobileSignIn;
	sendPage(
		res.status(410),
		locale,
		texts.expiredTitle,
		`<h1>${escapeHtml(texts.expiredTitle)}</h1><p>${escapeHtml(texts.expiredBody)}</p>`,
	);
}

/**
 * `/m/auth/callback` reached in the browser: the app did not take the
 * link (not installed, or the system did not hand it over). The button
 * repeats the same link, which a tap may still open in the app.
 */
export function sendCallbackFallback(
	res: Response,
	options: {
		readonly locale: Locale;
		readonly failed: boolean;
		readonly href: string;
	},
): void {
	const texts = messagesFor(options.locale).mobileSignIn;
	const app = brand.appName;
	const title = texts.callbackTitle({ app });
	const message = options.failed ? texts.callbackError : texts.callbackBody;
	sendPage(
		res,
		options.locale,
		title,
		`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><div class="actions"><a class="button" href="${escapeHtml(options.href)}">${escapeHtml(texts.openApp({ app }))}</a></div>`,
	);
}
