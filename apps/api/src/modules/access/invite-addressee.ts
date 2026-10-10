import { UserModel } from "../users/user-model.js";

/** Who an invitation or a share is addressed to (one of the two is set). */
export interface Addressee {
	readonly userId?: string | null;
	readonly email?: string | null;
}

export type AddresseeProblem = "NOT_INVITEE" | "EMAIL_NOT_VERIFIED";

/**
 * Whether the account `sub` is the one an invitation (project, workspace)
 * or a share was addressed to:
 * - addressed to an account: that account only;
 * - addressed to an email without an account: an account whose email the
 *   IdP verified (Google/GitHub) and that equals it, lower-cased. An
 *   unverified email that merely reads the same is not enough, or anyone
 *   could register the address and take the seat.
 */
export async function addresseeProblem(
	sub: string,
	addressee: Addressee,
): Promise<AddresseeProblem | null> {
	if (addressee.userId) {
		return addressee.userId === sub ? null : "NOT_INVITEE";
	}
	const user = await UserModel.findOne({ sub })
		.select("email emailVerified")
		.lean<{ email?: string | null; emailVerified?: boolean }>();
	const email = user?.email?.trim().toLowerCase();
	if (!addressee.email || email !== addressee.email) return "NOT_INVITEE";
	return user?.emailVerified === true ? null : "EMAIL_NOT_VERIFIED";
}
