import type { Locale } from "@localman/shared";
import { type ServerMessages, en } from "./messages/en.js";
import { vi } from "./messages/vi.js";
import { zhCN } from "./messages/zh-cn.js";

export type { ServerMessages } from "./messages/en.js";

/** One dictionary per supported locale; a missing locale fails typecheck. */
const DICTIONARIES: Readonly<Record<Locale, ServerMessages>> = {
	en,
	"zh-CN": zhCN,
	vi,
};

/** Server texts (notifications, owner alerts) in `locale`. */
export function messagesFor(locale: Locale): ServerMessages {
	return DICTIONARIES[locale];
}

/** A whole count in the locale's digits grouping: 10,000 / 10.000. */
export function formatCount(locale: Locale, value: number): string {
	return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
		value,
	);
}
