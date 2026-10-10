import { defineOperation } from "@localman/operations";
import { SUPPORTED_LOCALES } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { currentUserSchema, loadCurrentUser, signedOut } from "./me-view.js";
import { UserModel } from "./user-model.js";

export const getMe = defineOperation({
	id: "users.getMe",
	method: "GET",
	path: "/users/me",
	summary: "Get the signed-in user",
	description:
		"Profile synced from auth.hoandat.com at sign-in, the Localman plan in force, whether the user owns this deployment (admin), whether a Telegram chat is linked for notifications, the interface language notifications use (`en` until chosen), and the Pro trial (`available`, `active` or `ended`, its end, the latest extension request).",
	input: z.object({}),
	output: currentUserSchema,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: true,
	handler: (ctx) => loadCurrentUser(requireSubject(ctx)),
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
