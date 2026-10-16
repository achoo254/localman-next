import { COMMENT_MENTIONS_MAX } from "@localman/shared/api-client";
import { elementRoleOf } from "../access/access-policy.js";
import type { ElementRecord } from "../access/element-adapters.js";
import { CASE_INSENSITIVE_COLLATION, UserModel } from "../users/user-model.js";

/**
 * `@username` not glued to a word or an email (`a@b.c` is no mention);
 * a trailing dot ends the sentence, not the name.
 */
const MENTION =
	/(?<![\w@.])@([A-Za-z0-9_](?:[A-Za-z0-9._-]{0,62}[A-Za-z0-9_])?)/g;

/** Usernames @mentioned in a Markdown body, once each, in order. */
export function mentionedUsernames(body: string): string[] {
	const names = new Map<string, string>();
	for (const match of body.matchAll(MENTION)) {
		const name = match[1];
		if (name === undefined) continue;
		const key = name.toLowerCase();
		if (!names.has(key)) names.set(key, name);
		if (names.size >= COMMENT_MENTIONS_MAX) break;
	}
	return [...names.values()];
}

/**
 * The accounts these usernames name that can open the element (a mention
 * of someone without access tells them nothing), without `except`.
 */
export async function mentionedReaders(
	body: string,
	element: ElementRecord,
	except: string,
): Promise<string[]> {
	const usernames = mentionedUsernames(body);
	if (usernames.length === 0) return [];
	const users = await UserModel.find(
		{ username: { $in: usernames } },
		{ sub: 1 },
	)
		.collation(CASE_INSENSITIVE_COLLATION)
		.lean<{ sub: string }[]>();
	return readersAmong(
		users.map((user) => user.sub),
		element,
		except,
	);
}

/** Those of `subs` (once each, without `except`) who hold a role on it. */
export async function readersAmong(
	subs: readonly string[],
	element: ElementRecord,
	except: string,
): Promise<string[]> {
	const unique = [...new Set(subs)].filter((sub) => sub !== except);
	const roles = await Promise.all(
		unique.map((sub) => elementRoleOf(sub, element, { claim: false })),
	);
	return unique.filter((_, index) => roles[index] !== null);
}
