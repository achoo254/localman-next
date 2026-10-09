import { z } from "zod";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { UserModel } from "./user-model.js";

/** A malformed optional claim is dropped instead of failing the sign-in. */
const optional = <T extends z.ZodType>(schema: T) =>
	schema.optional().catch(undefined);

const httpUrl = z
	.string()
	.max(2048)
	.refine((value) => /^https?:\/\//.test(value) && URL.canParse(value));

/** Userinfo claims Localman reads (`openid profile email telegram`). */
const userInfoClaims = z.object({
	sub: z.string().min(1).max(255),
	preferred_username: optional(z.string().min(1).max(64)),
	email: optional(z.string().min(3).max(254)),
	email_verified: optional(z.boolean()),
	name: optional(z.string().min(1).max(200)),
	picture: optional(httpUrl),
	telegram_chat_id: optional(z.string().regex(/^-?\d{1,20}$/)),
	telegram_username: optional(z.string().regex(/^[A-Za-z0-9_]{1,64}$/)),
});

/** Splits values into a `$set` of present ones and an `$unset` of absent ones. */
function setOrUnset(values: Record<string, string | undefined>): {
	$set: Record<string, string>;
	$unset: Record<string, 1>;
} {
	const $set: Record<string, string> = {};
	const $unset: Record<string, 1> = {};
	for (const [key, value] of Object.entries(values)) {
		if (value === undefined) $unset[key] = 1;
		else $set[key] = value;
	}
	return { $set, $unset };
}

/**
 * Upserts the user from userinfo. Runs at every sign-in and refresh so the
 * profile and the linked Telegram chat follow the IdP; a new chat clears
 * the "bot blocked" mark of the previous one.
 */
export async function syncUserFromUserInfo(
	claims: unknown,
	expectedSub: string,
): Promise<void> {
	const info = userInfoClaims.parse(claims);
	if (info.sub !== expectedSub) throw new Error("userinfo subject mismatch");

	const fields = setOrUnset({
		email: info.email,
		name: info.name,
		picture: info.picture,
		"telegram.chatId": info.telegram_chat_id,
		"telegram.username": info.telegram_chat_id
			? info.telegram_username
			: undefined,
	});
	const upsert = async (): Promise<void> => {
		const existing = await UserModel.findOne({ sub: info.sub })
			.select("telegram.chatId")
			.lean();
		// Userinfo was just read: a pending relink is resolved.
		const unset: Record<string, 1> = {
			...fields.$unset,
			"telegram.refreshPendingAt": 1,
		};
		if (existing?.telegram?.chatId !== info.telegram_chat_id) {
			unset["telegram.blockedAt"] = 1;
		}
		await UserModel.updateOne(
			{ sub: info.sub },
			{
				$set: {
					...fields.$set,
					username: info.preferred_username ?? info.sub,
					emailVerified: info.email_verified ?? false,
				},
				...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
			},
			{ upsert: true, setDefaultsOnInsert: true },
		);
	};
	try {
		await upsert();
	} catch (error) {
		// Two first sign-ins racing: the loser retries as an update.
		if (!isDuplicateKeyError(error)) throw error;
		await upsert();
	}
}
