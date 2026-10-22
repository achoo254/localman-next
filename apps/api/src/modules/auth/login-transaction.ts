import { randomBytes } from "node:crypto";
import { type Locale, isLocale } from "@localman/shared";
import mongoose, { Schema } from "mongoose";
import * as oidc from "openid-client";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { APP_STATE } from "./auth-redirects.js";
import { hashSessionToken } from "./session-store.js";

/** How long a user may take at the IdP before the callback is refused. */
export const LOGIN_TRANSACTION_TTL_MS = 10 * 60 * 1000;

/**
 * One pending sign-in: the PKCE verifier, state and nonce stay on the
 * server; the browser only holds a random handle in a short-lived cookie,
 * which binds the callback to the browser that started the sign-in.
 */
const loginTransactionSchema = new Schema(
	{
		_id: { type: String, required: true },
		state: { type: String, required: true },
		nonce: { type: String, required: true },
		codeVerifier: { type: String, required: true },
		returnTo: { type: String, required: true },
		silent: { type: Boolean, default: false },
		recreate: { type: Boolean, default: false },
		/** Native app sign-in; see MobileSignIn. */
		mobile: {
			type: new Schema(
				{
					appState: { type: String, required: true },
					codeChallenge: { type: String, required: true },
					locale: { type: String, required: true },
				},
				{ _id: false },
			),
			required: false,
		},
		expiresAt: { type: Date, required: true, expires: 0 },
	},
	{ collection: "login_transactions", versionKey: false },
);

loginTransactionSchema.plugin(tenantScopePlugin);
const LoginTransactionModel = mongoose.model(
	"LoginTransaction",
	loginTransactionSchema,
);

/**
 * What the native app sent to `/auth/login?client=mobile`: its own
 * `state` (echoed to its callback) and PKCE S256 challenge (checked when
 * it redeems the handoff code), and the language of the pages it sees.
 */
export interface MobileSignIn {
	readonly appState: string;
	readonly codeChallenge: string;
	readonly locale: Locale;
}

/** S256 challenge: BASE64URL of a SHA-256, always 43 characters. */
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

/**
 * The app's parameters of `/auth/login?client=mobile`, or `null` when
 * they are missing or malformed (only S256 is accepted).
 */
export function mobileSignInFrom(
	query: Readonly<Record<string, unknown>>,
): MobileSignIn | null {
	const { state, code_challenge, code_challenge_method, locale } = query;
	if (typeof state !== "string" || !APP_STATE.test(state)) return null;
	if (typeof code_challenge !== "string") return null;
	if (!CODE_CHALLENGE.test(code_challenge)) return null;
	if (code_challenge_method !== undefined && code_challenge_method !== "S256") {
		return null;
	}
	return {
		appState: state,
		codeChallenge: code_challenge,
		locale: isLocale(locale) ? locale : "en",
	};
}

export interface LoginTransaction {
	readonly state: string;
	readonly nonce: string;
	readonly codeVerifier: string;
	readonly returnTo: string;
	/** `prompt=none`: a refusal sends the browser back without an error. */
	readonly silent: boolean;
	/**
	 * The visitor chose "Create a new account" after a deletion: the
	 * callback may make an account for an IdP subject deleted before.
	 */
	readonly recreate: boolean;
	/** Set for the native app: the callback hands off instead of a cookie. */
	readonly mobile?: MobileSignIn;
}

/** A new pending sign-in, not stored yet (see `saveLoginTransaction`). */
export function newLoginTransaction(
	returnTo: string,
	silent: boolean,
	recreate = false,
	mobile?: MobileSignIn,
): LoginTransaction & { cookieValue: string } {
	return {
		cookieValue: randomBytes(32).toString("base64url"),
		state: oidc.randomState(),
		nonce: oidc.randomNonce(),
		codeVerifier: oidc.randomPKCECodeVerifier(),
		returnTo,
		silent,
		recreate,
		mobile,
	};
}

export async function saveLoginTransaction(
	transaction: LoginTransaction & { cookieValue: string },
): Promise<void> {
	const { cookieValue, ...fields } = transaction;
	await LoginTransactionModel.create({
		_id: hashSessionToken(cookieValue),
		...fields,
		expiresAt: new Date(Date.now() + LOGIN_TRANSACTION_TTL_MS),
	});
}

/**
 * Returns and deletes the transaction, so a callback is accepted once. It
 * is consumed only when the callback's `state` matches: a forged callback
 * (another state) cannot cancel the user's real sign-in in progress.
 */
export async function consumeLoginTransaction(
	cookieValue: string | undefined,
	state: unknown,
): Promise<LoginTransaction | null> {
	if (!cookieValue || !/^[A-Za-z0-9_-]{43}$/.test(cookieValue)) return null;
	if (typeof state !== "string" || state === "") return null;
	const found = await LoginTransactionModel.findOneAndDelete({
		_id: hashSessionToken(cookieValue),
		state,
		expiresAt: { $gt: new Date() },
	}).lean();
	if (!found) return null;
	return {
		state: found.state,
		nonce: found.nonce,
		codeVerifier: found.codeVerifier,
		returnTo: found.returnTo,
		silent: found.silent === true,
		recreate: found.recreate === true,
		mobile: found.mobile
			? {
					appState: found.mobile.appState,
					codeChallenge: found.mobile.codeChallenge,
					locale: isLocale(found.mobile.locale) ? found.mobile.locale : "en",
				}
			: undefined,
	};
}
