import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32;
/** Characters kept in clear to tell tokens apart in the UI. */
const LAST_CHARS = 4;

export interface IssuedPrefixedToken {
	/** Returned to its owner once; never stored or logged. */
	readonly token: string;
	/** SHA-256 (hex) under which it is stored and looked up. */
	readonly hash: string;
	readonly last4: string;
}

/** SHA-256 (hex) of a presented token. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token, "utf8").digest("hex");
}

/** `prefix` + 32 random bytes in base64url; the prefix makes leaks recognizable. */
export function issuePrefixedToken(prefix: string): IssuedPrefixedToken {
	const token = `${prefix}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
	return { token, hash: hashToken(token), last4: token.slice(-LAST_CHARS) };
}
