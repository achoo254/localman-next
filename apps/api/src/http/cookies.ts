import type { CookieOptions, Request } from "express";

/** Name and flags of one cookie, derived from the public URL. */
export interface CookieSpec {
	readonly name: string;
	readonly options: CookieOptions;
}

/**
 * A `__Host-` cookie needs `Secure`, which browsers refuse over plain http.
 * Over https (production) the prefixed name pins the cookie to this host
 * and path `/`; over http://localhost (development) the bare name is used.
 */
export function cookieSpec(
	publicUrl: string,
	baseName: string,
	options: Pick<CookieOptions, "sameSite" | "maxAge">,
): CookieSpec {
	const secure = new URL(publicUrl).protocol === "https:";
	return {
		name: secure ? `__Host-${baseName}` : baseName,
		options: { httpOnly: true, secure, path: "/", ...options },
	};
}

/** Reads one cookie value from the request without a parsing middleware. */
export function readCookie(req: Request, name: string): string | undefined {
	const header = req.headers.cookie;
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() !== name) continue;
		const value = part.slice(separator + 1).trim();
		return value === "" ? undefined : value;
	}
	return undefined;
}
