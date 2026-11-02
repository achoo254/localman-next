import { OperationError } from "@localman/operations";
import { SUPPORTED_LOCALES } from "@localman/shared";
import { z } from "zod";
import { LEGACY_PLAN, legacyPlanSchema } from "../billing/legacy-plan-field.js";
import { isOwnerSub } from "./owner-access.js";
import { localeOrDefault } from "./user-locale.js";
import { UserModel } from "./user-model.js";

/** `GET /users/me`. */
export const currentUserSchema = z.object({
	sub: z.string(),
	username: z.string(),
	email: z.string().nullable(),
	emailVerified: z.boolean(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	plan: legacyPlanSchema,
	/** Owner of this Localman deployment (`OWNER_SUBS`): admin pages. */
	isOwner: z.boolean(),
	telegram: z.object({
		linked: z.boolean(),
		username: z.string().nullable(),
	}),
	/** Interface language for notifications; `en` until the user picks one. */
	locale: z.enum(SUPPORTED_LOCALES),
});

export type CurrentUser = z.output<typeof currentUserSchema>;

export const signedOut = (): OperationError =>
	new OperationError(401, "UNAUTHENTICATED", "Authentication required");

interface StoredUser {
	sub: string;
	username: string;
	email?: string | null;
	emailVerified: boolean;
	name?: string | null;
	picture?: string | null;
	telegram?: { chatId?: string | null; username?: string | null } | null;
	locale?: string | null;
}

/** The signed-in user as the API shows them; 401 when unknown. */
export async function loadCurrentUser(sub: string): Promise<CurrentUser> {
	const user = await UserModel.findOne({ sub })
		.select("sub username email emailVerified name picture telegram locale")
		.lean<StoredUser>();
	// Signed in sessions always have a user (upserted at sign-in).
	if (!user) throw signedOut();
	return {
		sub: user.sub,
		username: user.username,
		email: user.email ?? null,
		emailVerified: user.emailVerified,
		name: user.name ?? null,
		picture: user.picture ?? null,
		plan: LEGACY_PLAN,
		isOwner: isOwnerSub(user.sub),
		telegram: {
			linked: Boolean(user.telegram?.chatId),
			username: user.telegram?.username ?? null,
		},
		locale: localeOrDefault(user.locale),
	};
}
