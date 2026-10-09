import type { Locale } from "@localman/shared/constants";
import type { Messages } from "./message-types";
import { en } from "./messages/en/dictionary";

/**
 * English ships in the main bundle (the prerendered landing and the
 * default); the other languages are separate chunks fetched when chosen.
 */
const LOADERS: Record<Exclude<Locale, "en">, () => Promise<Messages>> = {
	vi: async () => (await import("./messages/vi/dictionary")).vi,
	"zh-CN": async () => (await import("./messages/zh-CN/dictionary")).zhCN,
};

const loaded = new Map<Locale, Promise<Messages>>([
	["en", Promise.resolve(en)],
]);

/**
 * Dictionary of `locale`, fetched once. A failed fetch (offline, deploy
 * replaced the chunk) is forgotten so the next attempt tries again.
 */
export function loadMessages(locale: Locale): Promise<Messages> {
	const cached = loaded.get(locale);
	if (cached) return cached;
	if (locale === "en") return Promise.resolve(en);
	const pending = LOADERS[locale]().catch((error: unknown) => {
		loaded.delete(locale);
		throw error;
	});
	loaded.set(locale, pending);
	return pending;
}
