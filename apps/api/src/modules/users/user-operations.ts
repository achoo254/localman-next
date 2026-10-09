import { OperationError, defineOperation } from "@localman/operations";
import { SUPPORTED_LOCALES } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { effectivePlan } from "../billing/plan-guard.js";
import { isOwnerSub } from "./owner-access.js";
import { localeOrDefault } from "./user-locale.js";
import { UserModel } from "./user-model.js";

const currentUser = z.object({
	sub: z.string(),
	username: z.string(),
	email: z.string().nullable(),
	emailVerified: z.boolean(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	/** Plan in force: an expired Pro is reported as Free. */
	plan: z.enum(["free", "pro"]),
	/** Owner of this Localman deployment (`OWNER_SUBS`): admin pages. */
	isOwner: z.boolean(),
	telegram: z.object({
		linked: z.boolean(),
		username: z.string().nullable(),
	}),
	/** Interface language for notifications; `en` until the user picks one. */
	locale: z.enum(SUPPORTED_LOCALES),
});

const signedOut = () =>
	new OperationError(401, "UNAUTHENTICATED", "Authentication required");

interface StoredUser {
	sub: string;
	username: string;
	email?: string | null;
	emailVerified: boolean;
	name?: string | null;
	picture?: string | null;
	plan: "free" | "pro";
	planExpiresAt?: Date | null;
	telegram?: { chatId?: string | null; username?: string | null } | null;
	locale?: string | null;
}

export const getMe = defineOperation({
	id: "users.getMe",
	method: "GET",
	path: "/users/me",
	summary: "Get the signed-in user",
	description:
		"Profile synced from auth.hoandat.com at sign-in, the Localman plan in force, whether the user owns this deployment (admin), whether a Telegram chat is linked for notifications, and the interface language notifications use (`en` until chosen).",
	input: z.object({}),
	output: currentUser,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: true,
	handler: async (ctx) => {
		const user = await UserModel.findOne({ sub: requireSubject(ctx) })
			.select(
				"sub username email emailVerified name picture plan planExpiresAt telegram locale",
			)
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
			plan: effectivePlan({
				plan: user.plan,
				planExpiresAt: user.planExpiresAt ?? null,
			}),
			isOwner: isOwnerSub(user.sub),
			telegram: {
				linked: Boolean(user.telegram?.chatId),
				username: user.telegram?.username ?? null,
			},
			locale: localeOrDefault(user.locale),
		};
	},
});

export const setLocale = defineOperation({
	id: "users.setLocale",
	method: "PUT",
	path: "/users/me/locale",
	summary: "Set the signed-in user's interface language",
	description: `Language of the user's notifications (in-app, Web Push, Telegram): one of ${SUPPORTED_LOCALES.join(", ")}. In-app notifications already received are shown in the new language too.`,
	input: z.object({ locale: z.enum(SUPPORTED_LOCALES) }),
	output: z.object({ locale: z.enum(SUPPORTED_LOCALES) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "users",
	mcp: true,
	handler: async (ctx, input) => {
		const { matchedCount } = await UserModel.updateOne(
			{ sub: requireSubject(ctx) },
			{ $set: { locale: input.locale } },
		);
		if (matchedCount === 0) throw signedOut();
		return { locale: input.locale };
	},
});
