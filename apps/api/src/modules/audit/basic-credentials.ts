import { createHash, timingSafeEqual } from "node:crypto";

export interface BasicCredentials {
	readonly clientId: string;
	readonly clientSecret: string;
}

function digest(value: string): Buffer {
	return createHash("sha256").update(value, "utf8").digest();
}

/** Constant-time string equality (digests have equal length). */
function sameSecret(a: string, b: string): boolean {
	return timingSafeEqual(digest(a), digest(b));
}

/**
 * Checks `Authorization: Basic base64(id:secret)` as the IdP sends it:
 * decoded, split at the first `:` (the id has none, the secret may contain
 * `+/=` and is not URL-encoded), both parts compared in constant time.
 */
export function hasValidBasicCredentials(
	header: string | undefined,
	expected: BasicCredentials,
): boolean {
	const match = header
		? /^Basic ([A-Za-z0-9+/]+=*)$/i.exec(header.trim())
		: null;
	if (!match?.[1]) return false;
	const decoded = Buffer.from(match[1], "base64").toString("utf8");
	const separator = decoded.indexOf(":");
	if (separator < 0) return false;
	const idMatches = sameSecret(decoded.slice(0, separator), expected.clientId);
	const secretMatches = sameSecret(
		decoded.slice(separator + 1),
		expected.clientSecret,
	);
	return idMatches && secretMatches;
}
