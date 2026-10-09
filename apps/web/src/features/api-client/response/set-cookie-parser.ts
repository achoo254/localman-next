/**
 * `Set-Cookie` headers of a response as table rows. Display only: nothing
 * here is applied to the browser. Attribute names are case-insensitive;
 * unknown attributes are ignored, like browsers do.
 */
import type { HeaderEntry } from "@localman/shared/api-client";

export interface ParsedCookie {
	name: string;
	value: string;
	/** `Domain` attribute, else the host of the URL that set it. */
	domain: string;
	/** `Path` attribute, else the default path of that URL (RFC 6265 §5.1.4). */
	path: string;
	/** `Expires` as sent; `null` when absent. */
	expires: string | null;
	/** `Max-Age` in seconds; `null` when absent or not a number. */
	maxAge: number | null;
	httpOnly: boolean;
	secure: boolean;
	sameSite: string | null;
}

function defaultPath(pathname: string): string {
	if (!pathname.startsWith("/")) return "/";
	const last = pathname.lastIndexOf("/");
	return last <= 0 ? "/" : pathname.slice(0, last);
}

function urlParts(url: string): { host: string; path: string } {
	try {
		const parsed = new URL(url);
		return { host: parsed.hostname, path: defaultPath(parsed.pathname) };
	} catch {
		return { host: "", path: "/" };
	}
}

/** One header value; `null` when it has no `name=` pair. */
export function parseSetCookie(
	header: string,
	requestUrl: string,
): ParsedCookie | null {
	const [pair = "", ...attributes] = header.split(";");
	const equals = pair.indexOf("=");
	if (equals < 1) return null;
	const defaults = urlParts(requestUrl);
	const cookie: ParsedCookie = {
		name: pair.slice(0, equals).trim(),
		value: pair.slice(equals + 1).trim(),
		domain: defaults.host,
		path: defaults.path,
		expires: null,
		maxAge: null,
		httpOnly: false,
		secure: false,
		sameSite: null,
	};
	if (cookie.name === "") return null;
	for (const attribute of attributes) {
		const [rawKey = "", ...rest] = attribute.split("=");
		const key = rawKey.trim().toLowerCase();
		const value = rest.join("=").trim();
		if (key === "domain" && value) cookie.domain = value.replace(/^\./, "");
		else if (key === "path" && value.startsWith("/")) cookie.path = value;
		else if (key === "expires" && value) cookie.expires = value;
		else if (key === "max-age" && /^-?\d+$/.test(value)) {
			cookie.maxAge = Number(value);
		} else if (key === "httponly") cookie.httpOnly = true;
		else if (key === "secure") cookie.secure = true;
		else if (key === "samesite" && value) cookie.sameSite = value;
	}
	return cookie;
}

/** Every valid `Set-Cookie` of `headers`, in arrival order. */
export function cookiesFromHeaders(
	headers: readonly HeaderEntry[],
	requestUrl: string,
): ParsedCookie[] {
	return headers
		.filter((header) => header.name.toLowerCase() === "set-cookie")
		.map((header) => parseSetCookie(header.value, requestUrl))
		.filter((cookie): cookie is ParsedCookie => cookie !== null);
}
