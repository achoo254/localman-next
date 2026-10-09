import { en } from "../i18n/messages/en/dictionary";

/**
 * Words that advertise features not in production yet, in English and in
 * Vietnamese (pages not moved to the dictionaries yet). With every flag
 * off, no user-facing copy may contain them (docs/ux-writing.md §3).
 * "Webhook" is the one exception: it may appear on a card announced with
 * the "Coming soon" badge.
 */
export const UNRELEASED_WORDS: readonly RegExp[] = [
	/localhost ngay trên trình duyệt/i,
	/right in your browser/i,
	/live mock sync/i,
	/\bmcp\b/i,
	/proxy/i,
	/trash/i,
	/thùng rác/i,
	/api client/i,
	/tunelo/i,
	/collection/i,
	/environment/i,
	/secret không rời/i,
	/secrets? never leave/i,
	/mock lai/i,
	/hybrid mock/i,
	/webhook/i,
];

const COMING_SOON = en.landing.features.comingSoon;
const NAMED_ATTRIBUTES = ["aria-label", "title", "alt", "href", "placeholder"];

/**
 * Unreleased words found in `root`: its text plus accessible names, titles
 * and links. Cards carrying a "Coming soon" badge are left out.
 */
export function unreleasedMentions(root: Element): string[] {
	const copy = root.cloneNode(true);
	if (!(copy instanceof Element)) return [];
	for (const badge of copy.querySelectorAll("span")) {
		if (badge.textContent?.trim() !== COMING_SOON) continue;
		badge.closest("article")?.remove();
	}
	const attributes = [copy, ...copy.querySelectorAll("*")].flatMap((element) =>
		NAMED_ATTRIBUTES.map((name) => element.getAttribute(name) ?? ""),
	);
	const text = [copy.textContent ?? "", ...attributes].join("\n");
	return UNRELEASED_WORDS.filter((word) => word.test(text)).map(String);
}
