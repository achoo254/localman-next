import type { ContactCategory } from "@localman/shared";
import { maskEmail } from "../../lib/mask-email.js";
import type { ParsedContact } from "./contact-message-schema.js";

/** Longest excerpt of the message sent to Telegram, in characters. */
export const ALERT_EXCERPT_MAX = 300;

const CATEGORY_LABELS: Readonly<Record<ContactCategory, string>> = {
	feedback: "Góp ý",
	bug: "Báo lỗi",
	plan_question: "Hỏi về gói",
};

/**
 * Control characters (newlines included), zero-width, word-joiner, bidi
 * mark and override characters (the Arabic letter mark U+061C included):
 * they could fake extra lines or reorder text in the chat.
 */
const UNSAFE =
	// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping them is the point.
	/[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]+/g;

/** Inserted after `@`, `#` and `/` so Telegram does not make them links. */
const WORD_JOINER = "\u2060";

/**
 * Breaks what Telegram turns into links in plain text, so the owner never
 * taps a link a stranger wrote: `https://` becomes `hxxps://`, a dot
 * before a letter inside a word becomes `[.]` (domains, emails), and a
 * word joiner follows `@`, `#` and a leading `/` (mentions, hashtags, bot
 * commands). Runs after `UNSAFE` is stripped, so the joiners it adds stay.
 */
export function defangLinks(text: string): string {
	return text
		.replace(/(?<![\p{L}\p{N}])(https?|ftp)(?=:\/\/)/giu, (scheme) =>
			scheme.replace(/t/gi, "x"),
		)
		.replace(/(?<=[\p{L}\p{N}])\.(?=\p{L})/gu, "[.]")
		.replace(/[@#]|(?<![\p{L}\p{N}/\]])\/(?=\p{L})/gu, `$&${WORD_JOINER}`);
}

/**
 * One line of at most `ALERT_EXCERPT_MAX` characters (code points, so an
 * emoji is never cut in half), links defanged. The alert is sent as plain
 * text without `parse_mode`, so no markup escaping is needed.
 */
export function alertExcerpt(message: string): string {
	const flat = defangLinks(
		message.replace(UNSAFE, " ").replace(/\s+/g, " ").trim(),
	);
	const chars = Array.from(flat);
	if (chars.length <= ALERT_EXCERPT_MAX) return flat;
	return `${chars
		.slice(0, ALERT_EXCERPT_MAX - 1)
		.join("")
		.trimEnd()}…`;
}

function contactLine(contact: ParsedContact | null): string {
	if (contact === null) return "không để lại";
	if (contact.contactKind === "email") {
		return `email ${maskEmail(contact.contact)}`;
	}
	return `Telegram ${contact.contact.slice(0, 3)}***`;
}

/**
 * Short Telegram alert for the owner: category, an excerpt of the message,
 * the masked reply address and the source. No name; the full message and
 * address are on the admin inbox.
 */
export function contactAlertText(entry: {
	readonly category: ContactCategory;
	readonly message: string;
	readonly contact: ParsedContact | null;
	readonly signedIn: boolean;
	readonly source: string;
}): string {
	return [
		`Góp ý / Liên hệ mới: ${CATEGORY_LABELS[entry.category]}`,
		`Nội dung: ${alertExcerpt(entry.message)}`,
		`Liên hệ: ${contactLine(entry.contact)}`,
		`Người gửi: ${entry.signedIn ? "đã đăng nhập" : "khách"}`,
		`Nguồn: ${entry.source}`,
	].join("\n");
}
