import mongoose, { Schema } from "mongoose";
import { z } from "zod";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

/**
 * Who holds the session token: a browser (`__Host-lm_session` cookie) or
 * the native app (`Authorization: Bearer`). Each is accepted only the
 * way it was issued (docs/decisions/0005-mobile-session-handoff.md).
 */
export type SessionClient = "web" | "mobile";

/**
 * A signed-in browser or app. `_id` is the SHA-256 of the token, so a
 * database read never yields a usable token. `tokens` holds the access,
 * refresh and ID tokens as one AES-256-GCM blob (see token-cipher.ts).
 */
const sessionSchema = new Schema(
	{
		_id: { type: String, required: true },
		sub: { type: String, required: true, index: true },
		/** IdP session id (`sid`), the key of back-channel logout. */
		sid: { type: String, index: true },
		/** Absent on sessions from before the app: a browser's. */
		client: { type: String, enum: ["web", "mobile"] },
		tokens: { type: String, required: true },
		accessTokenExpiresAt: { type: Date, required: true },
		/** Hard end of this session; MongoDB deletes it afterwards. */
		expiresAt: { type: Date, required: true, expires: 0 },
		/** Cross-process refresh lease; see session-refresher.ts. */
		refreshLockedUntil: { type: Date },
	},
	{ collection: "sessions", timestamps: true, versionKey: false },
);

sessionSchema.plugin(tenantScopePlugin);
export const SessionModel = mongoose.model("Session", sessionSchema);

export const sessionTokens = z.object({
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1).optional(),
	idToken: z.string().min(1).optional(),
});
export type SessionTokens = z.output<typeof sessionTokens>;

export interface Session {
	/** SHA-256 of the token; safe to log and to reference elsewhere. */
	readonly id: string;
	readonly sub: string;
	readonly sid?: string;
	readonly client: SessionClient;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
	readonly expiresAt: Date;
}

export interface NewSession {
	readonly sub: string;
	readonly sid?: string;
	/** `web` unless given. */
	readonly client?: SessionClient;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
}

/** A session document as `lean()` returns it. */
export interface StoredSession {
	_id: string;
	sub: string;
	sid?: string | null;
	client?: SessionClient | null;
	tokens: string;
	accessTokenExpiresAt: Date;
	expiresAt: Date;
	createdAt?: Date;
}
