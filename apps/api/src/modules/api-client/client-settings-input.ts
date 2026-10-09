import { OperationError } from "@localman/operations";
import { isLocalTarget, localTargetKey } from "@localman/shared/api-client";

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
 * Origin of a pasted tunnel URL (a path or query in the link is dropped).
 * Must be a public http(s) URL: a mapping to another local address would
 * not reach anything from the proxy.
 */
export function normalizeTunnelUrl(input: string): string {
	const value = input.trim();
	if (!URL.canParse(value)) {
		throw invalid("url", "must be an http(s) URL");
	}
	const parsed = new URL(value);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw invalid("url", "must be an http(s) URL");
	}
	if (isLocalTarget(parsed.origin)) {
		throw invalid("url", "must be a public URL, not a local address");
	}
	return parsed.origin;
}
