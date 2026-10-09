/** Pieces of a project's mock base URL, coloured separately on the page. */
export interface MockUrlParts {
	/** `https://` or `http://`. */
	scheme: string;
	/** Secret subdomain, or null when the host does not start with it. */
	secret: string | null;
	/** Host after the secret (`.mock.localman.app`), or the whole host. */
	host: string;
	/** API prefix (`/api/v1`), "" when none. */
	prefix: string;
}

/**
 * Splits `{scheme}{secret}.{domain}{prefix}` as built by the API. Falls back
 * to showing the host whole if the URL is not in that form.
 */
export function splitMockBaseUrl(
	mockBaseUrl: string,
	secret: string,
	prefix: string,
): MockUrlParts {
	const trimmed = mockBaseUrl.replace(/\/+$/, "");
	const withoutPrefix =
		prefix && trimmed.endsWith(prefix)
			? trimmed.slice(0, -prefix.length)
			: trimmed;
	const match = /^(https?:\/\/)(.*)$/.exec(withoutPrefix);
	const scheme = match?.[1] ?? "";
	const host = match?.[2] ?? withoutPrefix;
	const ownsSecret = secret !== "" && host.startsWith(`${secret}.`);
	return {
		scheme,
		secret: ownsSecret ? secret : null,
		host: ownsSecret ? host.slice(secret.length) : host,
		prefix: prefix && trimmed.endsWith(prefix) ? prefix : "",
	};
}
