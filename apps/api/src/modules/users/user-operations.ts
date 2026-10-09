import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { UserModel } from "./user-model.js";

const currentUser = z.object({
	sub: z.string(),
	username: z.string(),
	email: z.string().nullable(),
	emailVerified: z.boolean(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	plan: z.enum(["free", "pro"]),
	telegram: z.object({
		linked: z.boolean(),
		username: z.string().nullable(),
	}),
});

interface StoredUser {
	sub: string;
	username: string;
	email?: string | null;
	emailVerified: boolean;
	name?: string | null;
	picture?: string | null;
	plan: "free" | "pro";
	telegram?: { chatId?: string | null; username?: string | null } | null;
}

export const getMe = defineOperation({
	id: "users.getMe",
	method: "GET",
	path: "/users/me",
	summary: "Get the signed-in user",
	description:
		"Profile synced from auth.hoandat.com at sign-in, the Localman plan and whether a Telegram chat is linked for notifications.",
	input: z.object({}),
	output: currentUser,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "users",
	mcp: true,
	handler: async (ctx) => {
		const user = await UserModel.findOne({ sub: requireSubject(ctx) })
			.select("sub username email emailVerified name picture plan telegram")
			.lean<StoredUser>();
		// Signed in sessions always have a user (upserted at sign-in).
		if (!user) {
			throw new OperationError(
				401,
				"UNAUTHENTICATED",
				"Authentication required",
			);
		}
		return {
			sub: user.sub,
			username: user.username,
			email: user.email ?? null,
			emailVerified: user.emailVerified,
			name: user.name ?? null,
			picture: user.picture ?? null,
			plan: user.plan,
			telegram: {
				linked: Boolean(user.telegram?.chatId),
				username: user.telegram?.username ?? null,
			},
		};
	},
});
