import type { ClientSession, Types } from "mongoose";
import { UserModel } from "../users/user-model.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
} from "./collaborator-model.js";

/** The caller's email, lower-cased, if their IdP verified it. */
export async function verifiedEmailOf(sub: string): Promise<string | null> {
	const user = await UserModel.findOne({ sub })
		.select("email emailVerified")
		.lean<{ email?: string | null; emailVerified?: boolean }>();
	if (user?.emailVerified !== true || !user.email) return null;
	return user.email.trim().toLowerCase();
}

/**
 * Rows of the project that are the caller's: bound to their account, or
 * an unbound invitation to the email their IdP verified (which they could
 * accept themselves). Joining or accepting turns one of them into the
 * membership and drops the others with their seats.
 */
export function callerRowsFilter(
	projectId: Types.ObjectId,
	sub: string,
	verifiedEmail: string | null,
): Record<string, unknown> {
	const who: Record<string, unknown>[] = [{ inviteeUserId: sub }];
	if (verifiedEmail !== null) {
		who.push({
			status: "pending",
			inviteeUserId: { $exists: false },
			inviteeEmail: verifiedEmail,
		});
	}
	return { projectId, $or: who };
}

/** The caller's rows, the one bound to their account first. */
export async function callerRows(
	projectId: Types.ObjectId,
	sub: string,
	verifiedEmail: string | null,
	session: ClientSession | null = null,
): Promise<StoredCollaborator[]> {
	const rows = await CollaboratorModel.find(
		callerRowsFilter(projectId, sub, verifiedEmail),
	)
		.sort({ createdAt: 1, _id: 1 })
		.session(session)
		.lean<StoredCollaborator[]>();
	return rows.sort(
		(a, b) => Number(b.inviteeUserId === sub) - Number(a.inviteeUserId === sub),
	);
}
