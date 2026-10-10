import { UserModel } from "../users/user-model.js";

/**
 * The name a notification shows for the account: its name, else its
 * username; `null` when the account is gone.
 */
export async function displayNameOf(sub: string): Promise<string | null> {
	const user = await UserModel.findOne({ sub })
		.select("username name")
		.lean<{ username: string; name?: string | null }>();
	return user?.name || user?.username || null;
}
