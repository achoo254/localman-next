import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

/** Invitations and magic links work for 7 days. */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 32 random bytes (256 bits), URL-safe: `base64url` gives 43 characters. */
const TOKEN_BYTES = 32;

/** Shape check only; an unknown token is still rejected by its hash. */
export const inviteTokenSchema = z
	.string()
	.min(32)
	.max(128)
	.regex(/^[A-Za-z0-9_-]+$/, "Invalid invite token");

export interface IssuedToken {
	/** Shown once to the owner; never stored or logged. */
	readonly token: string;
	readonly tokenHash: string;
	readonly expiresAt: Date;
}

/** SHA-256 (hex) under which a token is stored and looked up. */
export function hashInviteToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function issueInviteToken(now: Date = new Date()): IssuedToken {
	const token = randomBytes(TOKEN_BYTES).toString("base64url");
	return {
		token,
		tokenHash: hashInviteToken(token),
		expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
	};
}

/**
 * Web page of an invitation or a magic link: `/invite/:token`. The page
 * asks `mock.previewInvite` which kind the token is.
 */
export function inviteLinkOf(token: string): string {
	return `/invite/${token}`;
}
