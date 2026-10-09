import { OperationError } from "@localman/operations";
import { isTunnelUrl, localTargetKey } from "@localman/shared/api-client";
import { messagesFor } from "../../i18n/server-messages.js";
import { readUserLocale } from "../users/user-locale.js";

/** Longest `host[:port]`: a 253-character name and a port. */
export const MAX_HOST_LENGTH = 260;

function invalid(field: string, message: string): OperationError {
	return new OperationError(400, "VALIDATION_ERROR", "Invalid input", [
		{ path: field, message },
	]);
}

/**
 * `host[:port]` of a remembered host, lowercase, as `URL.host` spells it
 * (the browser compares it with the request URL's `host`). Rejects
 * anything with a scheme, path, query or credentials.
 */
export function normalizeRoutingHost(input: string): string {
	const value = input.trim().toLowerCase();
	const href = `http://${value}/`;
	if (
		value === "" ||
		value.length > MAX_HOST_LENGTH ||
		/[\s/?#@\\]/.test(value) ||
		!URL.canParse(href)
	) {
		throw invalid("host", "must be a host name or IP, with an optional port");
	}
	const parsed = new URL(href);
	if (!parsed.hostname) {
		throw invalid("host", "must be a host name or IP, with an optional port");
	}
	return parsed.host;
}

/**
 * Canonical key of a local target with an explicit port: every loopback
 * spelling becomes `localhost` (`127.0.0.1:3000` → `localhost:3000`).
 */
export function normalizeTunnelKey(input: string): string {
	const value = input.trim();
	const key =
		/:\d{1,5}$/.test(value) && !/[\s/?#@\\]/.test(value)
			? localTargetKey(`http://${value}/`)?.key
			: undefined;
	if (!key) {
		throw invalid(
			"key",
			"must be a local host and port, e.g. localhost:3000 or 192.168.1.5:8080",
		);
	}
	return key;
}

/**
 * Origin of a Tunelo tunnel URL: `https://<label>.<domain>` with `domain`
 * one of `domains` (`TUNNEL_DOMAINS`) and nothing else (no port, path,
 * query, fragment or credentials). `null` when the URL is anything else:
 * the browser sends credentials to this origin, so it must be a tunnel.
 */
export function normalizeTunnelUrl(
	input: string,
	domains: readonly string[],
): string | null {
	const value = input.trim();
	if (!URL.canParse(value)) return null;
	const url = new URL(value);
	const bare =
		url.port === "" &&
		(url.pathname === "/" || url.pathname === "") &&
		url.search === "" &&
		url.hash === "" &&
		url.username === "" &&
		url.password === "" &&
		// `https://x.y/?` and `https://x.y/#` parse to empty search and hash.
		!/[?#]/.test(value);
	return bare && isTunnelUrl(url.href, domains) ? url.origin : null;
}

/** 400 `VALIDATION_ERROR` for a tunnel URL, in the user's language. */
export async function invalidTunnelUrl(
	sub: string,
	domains: readonly string[],
): Promise<OperationError> {
	const texts = messagesFor(await readUserLocale(sub)).apiClient;
	const message =
		domains.length === 0
			? texts.tunnelsDisabled
			: texts.tunnelUrlInvalid({ domains: domains.join(", ") });
	return new OperationError(400, "VALIDATION_ERROR", message, [
		{ path: "url", message },
	]);
}
