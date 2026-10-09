import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

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
	};
}

/** Session probe: 401 is a normal answer here, so it does not redirect. */
export async function fetchCurrentUser(): Promise<CurrentUser> {
	const data = await apiRequest("/api/v1/users/me", {
		redirectOnUnauthorized: false,
	});
	return parseCurrentUser(data);
}

/** Name shown in the header: display name, then username, then email. */
export function displayName(user: CurrentUser): string {
	return user.name || user.username || user.email || "Tài khoản";
}
