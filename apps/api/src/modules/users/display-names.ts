import { UserModel } from "./user-model.js";

/**
 * Names (else usernames) of these accounts in one query, for what shows
 * who made or changed something (collections, environments, trash).
 * Removed accounts are absent.
 */
export async function displayNames(
	subs: Iterable<string>,
): Promise<Map<string, string>> {
	const unique = [...new Set(subs)];
	if (unique.length === 0) return new Map();
	const users = await UserModel.find(
		{ sub: { $in: unique } },
		{ sub: 1, username: 1, name: 1 },
	).lean<{ sub: string; username: string; name?: string | null }[]>();
	return new Map(users.map((user) => [user.sub, user.name || user.username]));
}
