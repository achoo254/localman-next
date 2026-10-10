import { createHash } from "node:crypto";

/** Tokens are stored and compared as SHA-256 hex, never in plaintext. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}
