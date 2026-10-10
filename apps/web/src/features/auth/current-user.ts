import {
	DEFAULT_LOCALE,
	type Locale,
	isLocale,
} from "@localman/shared/constants";
import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";
import { type TrialInfo, parseTrial } from "../subscription/trial-state";

export type Plan = "free" | "pro";

export interface CurrentUser {
	sub: string;
	username: string | null;
	email: string | null;
	emailVerified: boolean;
	name: string | null;
	picture: string | null;
	plan: Plan;
	/** Localman operator: may open the admin pages. */
	isOwner: boolean;
	telegram: { linked: boolean; username: string | null };
	/** Language saved on the account (notifications use it); "en" if never chosen. */
	locale: Locale;
	/** Pro trial; an API without `trial` reads as a trial still available. */
	trial: TrialInfo;
}

export function parseCurrentUser(data: unknown): CurrentUser {
	const user = expectRecord(data, "user");
	const plan = expectString(user, "plan");
	if (plan !== "free" && plan !== "pro") {
		throw new InvalidResponseError(`plan "${plan}"`);
	}
	const telegram = expectRecord(user.telegram, "telegram");
	return {
		sub: expectString(user, "sub"),
		username: optionalString(user, "username"),
		email: optionalString(user, "email"),
		emailVerified: user.emailVerified === true,
		name: optionalString(user, "name"),
		picture: optionalString(user, "picture"),
		plan,
		isOwner: user.isOwner === true,
		telegram: {
			linked: expectBoolean(telegram, "linked"),
			username: optionalString(telegram, "username"),
		},
		locale: isLocale(user.locale) ? user.locale : DEFAULT_LOCALE,
		trial: parseTrial(user.trial),
	};
}

/** Session probe: 401 is a normal answer here, so it does not redirect. */
export async function fetchCurrentUser(): Promise<CurrentUser> {
	const data = await apiRequest("/api/v1/users/me", {
		redirectOnUnauthorized: false,
	});
	return parseCurrentUser(data);
}

/**
 * Name shown in the header: display name, then username, then email, then
 * `fallback` (the translated "Account").
 */
export function displayName(user: CurrentUser, fallback: string): string {
	return user.name || user.username || user.email || fallback;
}
