import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * CSRF tokens for the console's forms. A token is an HMAC of the session
 * id: pages of `*.tunnel.hoandat.com` are same-site (SameSite=Lax lets their
 * POSTs carry the cookie) but cannot read the page, so cannot know it.
 */
export class CsrfTokens {
	constructor(private readonly key: Buffer) {}

	issue(sessionId: string): string {
		return createHmac("sha256", this.key)
			.update(`csrf:${sessionId}`, "utf8")
			.digest("base64url");
	}

	verify(sessionId: string, provided: unknown): boolean {
		if (typeof provided !== "string" || provided.length > 128) return false;
		const expected = Buffer.from(this.issue(sessionId), "utf8");
		const actual = Buffer.from(provided, "utf8");
		return (
			expected.length === actual.length && timingSafeEqual(expected, actual)
		);
	}
}
