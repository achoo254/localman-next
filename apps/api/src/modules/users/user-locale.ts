import { DEFAULT_LOCALE, type Locale, isLocale } from "@localman/shared";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { UserModel } from "./user-model.js";

interface StoredLocale {
	locale?: string | null;
}

/** A stored value, or the default when unset or no longer supported. */
export function localeOrDefault(value: unknown): Locale {
	return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The user's interface language; `en` when unset or the user is unknown. */
export async function readUserLocale(sub: string): Promise<Locale> {
	const user = await UserModel.findOne({ sub })
		.select("locale")
		.lean<StoredLocale>();
	return localeOrDefault(user?.locale);
}

/**
 * Language of the deployment owner's alert chat: the user whose linked
 * Telegram chat is that chat, else the first owner (`OWNER_SUBS`) who chose
 * a language, else `en`.
 */
export async function readOwnerLocale(ownerChatId: string): Promise<Locale> {
	const byChat = await UserModel.findOne({
		"telegram.chatId": ownerChatId,
		locale: { $exists: true },
	})
		.select("locale")
		.lean<StoredLocale>();
	if (byChat) return localeOrDefault(byChat.locale);
	const owners = [...runtimeSettings().ownerSubs];
	if (owners.length === 0) return DEFAULT_LOCALE;
	const chosen = await UserModel.find({
		sub: { $in: owners },
		locale: { $exists: true },
	})
		.select("sub locale")
		.lean<(StoredLocale & { sub: string })[]>();
	const bySub = new Map(chosen.map((user) => [user.sub, user.locale]));
	for (const sub of owners) {
		if (bySub.has(sub)) return localeOrDefault(bySub.get(sub));
	}
	return DEFAULT_LOCALE;
}
