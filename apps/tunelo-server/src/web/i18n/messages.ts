import { en } from "./en.js";
import type { Locale } from "./locale.js";
import { vi } from "./vi.js";
import { zhCn } from "./zh-cn.js";

export type MessageKey = keyof typeof en;
export type Messages = Readonly<Record<MessageKey, string>>;

const DICTIONARIES: Readonly<Record<Locale, Messages>> = {
	en,
	"zh-CN": zhCn,
	vi,
};

export interface Translator {
	readonly locale: Locale;
	/** The message of `key` with `{name}` placeholders filled from `values`. */
	t(
		key: MessageKey,
		values?: Readonly<Record<string, string | number>>,
	): string;
	/** Picks `one` or `other` by the locale's plural rules, then fills `{count}`. */
	plural(count: number, one: MessageKey, other: MessageKey): string;
}

export function translator(locale: Locale): Translator {
	const messages = DICTIONARIES[locale];
	const rules = new Intl.PluralRules(locale);
	const t: Translator["t"] = (key, values = {}) =>
		messages[key].replace(/\{(\w+)\}/g, (match, name: string) => {
			const value = values[name];
			return value === undefined ? match : String(value);
		});
	return {
		locale,
		t,
		plural: (count, one, other) =>
			t(rules.select(count) === "one" ? one : other, { count }),
	};
}
