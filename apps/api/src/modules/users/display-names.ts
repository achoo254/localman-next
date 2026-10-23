import {
	LIVE_MOCK_SYNC_AUTHOR,
	LIVE_MOCK_SYNC_AUTHOR_NAME,
} from "../live-mock-sync/sync-keys.js";
import { UserModel } from "./user-model.js";

/**
 * Names (else usernames) of these accounts in one query, for what shows
 * who made or changed something (collections, environments, trash).
 * Removed accounts are absent; Live Mock Sync, which writes as no
 * account, has its own name.
 */
export async function displayNames(
	subs: Iterable<string>,
): Promise<Map<string, string>> {
	const unique = [...new Set(subs)];
	const names = new Map<string, string>();
	if (unique.includes(LIVE_MOCK_SYNC_AUTHOR)) {
		names.set(LIVE_MOCK_SYNC_AUTHOR, LIVE_MOCK_SYNC_AUTHOR_NAME);
	}
	if (unique.length === names.size) return names;
	const users = await UserModel.find(
		{ sub: { $in: unique } },
		{ sub: 1, username: 1, name: 1 },
	).lean<{ sub: string; username: string; name?: string | null }[]>();
	for (const user of users) names.set(user.sub, user.name || user.username);
	return names;
}
