import type { Response } from "express";
import { wasAccountDeleted } from "../account-deletion/deleted-account-model.js";
import { UserModel } from "../users/user-model.js";
import { type AuthCookies, clearCookie } from "./auth-cookies.js";
import { redirectToSignInError } from "./auth-redirects.js";
import type { LoginTransaction } from "./login-transaction.js";

/**
 * Whether the callback must stop before making an account: this IdP
 * subject's Localman account was deleted, no new one exists, and the
 * visitor did not choose "Create a new account". A 401 in a forgotten tab
 * or a silent sign-in on another device then lands on that choice instead
 * of quietly making a new, empty account (docs/decisions/0007).
 */
export async function refusesDeletedAccount(
	sub: string,
	transaction: Pick<LoginTransaction, "recreate">,
): Promise<boolean> {
	if (transaction.recreate) return false;
	if (!(await wasAccountDeleted(sub))) return false;
	return (await UserModel.exists({ sub })) === null;
}

/**
 * `refusesDeletedAccount` at the callback: answers the browser itself
 * (the "account deleted" choice on the landing, the silent sign-in hint
 * cleared) and returns `true` when the sign-in stops there.
 */
export async function refusedAsDeleted(
	res: Response,
	cookies: AuthCookies,
	sub: string,
	transaction: Pick<LoginTransaction, "recreate" | "mobile">,
): Promise<boolean> {
	if (!(await refusesDeletedAccount(sub, transaction))) return false;
	clearCookie(res, cookies.ssoHint);
	// The app cannot offer "Create a new account": it shows the error.
	redirectToSignInError(res, transaction, "account_deleted");
	return true;
}
