import { randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import * as oidc from "openid-client";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
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
		expiresAt: { type: Date, required: true, expires: 0 },
	},
	{ collection: "login_transactions", versionKey: false },
);

loginTransactionSchema.plugin(tenantScopePlugin);
const LoginTransactionModel = mongoose.model(
	"LoginTransaction",
	loginTransactionSchema,
);

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
}

/** A new pending sign-in, not stored yet (see `saveLoginTransaction`). */
export function newLoginTransaction(
	returnTo: string,
	silent: boolean,
	recreate = false,
): LoginTransaction & { cookieValue: string } {
	return {
		cookieValue: randomBytes(32).toString("base64url"),
		state: oidc.randomState(),
		nonce: oidc.randomNonce(),
		codeVerifier: oidc.randomPKCECodeVerifier(),
		returnTo,
		silent,
		recreate,
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
	};
}
