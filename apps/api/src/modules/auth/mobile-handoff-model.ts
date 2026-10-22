import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { type SessionTokens, sessionTokens } from "./session-model.js";
import { hashSessionToken } from "./session-store.js";
import type { TokenCipher } from "./token-cipher.js";

/** How long the confirmation page waits for Continue or Cancel. */
export const MOBILE_CONFIRM_TTL_MS = 5 * 60 * 1000;
/** How long the app has from Continue to redeeming the code. */
export const MOBILE_HANDOFF_TTL_MS = 60 * 1000;

/** A handoff code: 32 random bytes in base64url. */
const CODE_FORMAT = /^[A-Za-z0-9_-]{43}$/;

/**
 * A native app sign-in between the IdP callback and the app redeeming
 * its code: the IdP tokens (sealed, bound to the code's hash) wait here
 * instead of in a session, so a sign-in that is never confirmed or
 * redeemed leaves no session behind. `_id` is the SHA-256 of the code.
 */
const mobileHandoffSchema = new Schema(
	{
		_id: { type: String, required: true },
		sub: { type: String, required: true },
		sid: { type: String },
		tokens: { type: String, required: true },
		accessTokenExpiresAt: { type: Date, required: true },
		codeChallenge: { type: String, required: true },
		appState: { type: String, required: true },
		/** The user pressed Continue on the confirmation page. */
		confirmed: { type: Boolean, default: false },
		expiresAt: { type: Date, required: true, expires: 0 },
	},
	{ collection: "mobile_handoffs", versionKey: false },
);

mobileHandoffSchema.plugin(tenantScopePlugin);
export const MobileHandoffModel = mongoose.model(
	"MobileHandoff",
	mobileHandoffSchema,
);

export interface NewMobileHandoff {
	readonly sub: string;
	readonly sid?: string;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
	readonly codeChallenge: string;
	readonly appState: string;
}

/** A redeemed handoff: what a new mobile session is made of. */
export interface RedeemedHandoff {
	readonly sub: string;
	readonly sid?: string;
	readonly tokens: SessionTokens;
	readonly accessTokenExpiresAt: Date;
}

export type RedeemResult =
	| { readonly ok: true; readonly handoff: RedeemedHandoff }
	| { readonly ok: false; readonly reason: "invalid" | "expired" };

/** `BASE64URL(SHA256(verifier))`, RFC 7636 §4.6. */
export function pkceChallengeOf(verifier: string): string {
	return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

function sameText(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}

export class MobileHandoffStore {
	constructor(private readonly cipher: TokenCipher) {}

	/** Stores a pending handoff; returns its code (shown only here). */
	async create(input: NewMobileHandoff): Promise<string> {
		const code = randomBytes(32).toString("base64url");
		const id = hashSessionToken(code);
		await MobileHandoffModel.create({
			_id: id,
			sub: input.sub,
			sid: input.sid,
			tokens: this.cipher.encrypt(JSON.stringify(input.tokens), id),
			accessTokenExpiresAt: input.accessTokenExpiresAt,
			codeChallenge: input.codeChallenge,
			appState: input.appState,
			expiresAt: new Date(Date.now() + MOBILE_CONFIRM_TTL_MS),
		});
		return code;
	}

	/**
	 * Continue: the code becomes redeemable for `MOBILE_HANDOFF_TTL_MS`;
	 * returns the app state, or `null` for an unknown or used code.
	 */
	async confirm(code: unknown): Promise<string | null> {
		if (typeof code !== "string" || !CODE_FORMAT.test(code)) return null;
		const found = await MobileHandoffModel.findOneAndUpdate(
			{
				_id: hashSessionToken(code),
				confirmed: false,
				expiresAt: { $gt: new Date() },
			},
			{
				$set: {
					confirmed: true,
					expiresAt: new Date(Date.now() + MOBILE_HANDOFF_TTL_MS),
				},
			},
		).lean();
		return found ? found.appState : null;
	}

	/** Cancel: the handoff is gone; the app state, or `null`. */
	async cancel(code: unknown): Promise<string | null> {
		if (typeof code !== "string" || !CODE_FORMAT.test(code)) return null;
		const found = await MobileHandoffModel.findOneAndDelete({
			_id: hashSessionToken(code),
			confirmed: false,
		}).lean();
		return found ? found.appState : null;
	}

	/**
	 * Deletes the handoff first, then checks it: a code is redeemed at
	 * most once, and a wrong verifier burns it (no guessing).
	 */
	async redeem(code: string, verifier: string): Promise<RedeemResult> {
		if (!CODE_FORMAT.test(code)) return { ok: false, reason: "invalid" };
		const id = hashSessionToken(code);
		const found = await MobileHandoffModel.findOneAndDelete({ _id: id }).lean();
		if (!found?.confirmed) return { ok: false, reason: "invalid" };
		if (found.expiresAt.getTime() <= Date.now()) {
			return { ok: false, reason: "expired" };
		}
		if (!sameText(pkceChallengeOf(verifier), found.codeChallenge)) {
			return { ok: false, reason: "invalid" };
		}
		const tokens = sessionTokens.parse(
			JSON.parse(this.cipher.decrypt(found.tokens, id)),
		);
		return {
			ok: true,
			handoff: {
				sub: found.sub,
				sid: found.sid ?? undefined,
				tokens,
				accessTokenExpiresAt: found.accessTokenExpiresAt,
			},
		};
	}
}
