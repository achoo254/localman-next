import { WORKSPACE_ROLES } from "@localman/shared/access";
import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import type { StoredWorkspaceMember } from "./workspace-member-model.js";

export const memberView = z.object({
	id: z.string(),
	userId: z.string(),
	username: z.string(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
	role: z.enum(WORKSPACE_ROLES),
	isYou: z.boolean(),
});
export type MemberView = z.infer<typeof memberView>;

export const invitationView = z.object({
	id: z.string(),
	/** account: bound to an account; email: an address; link: one-use link. */
	kind: z.enum(["account", "email", "link"]),
	/** The invited account's username (`account` invitations). */
	username: z.string().nullable(),
	/** The invited address, lower-case, if one was typed. */
	email: z.string().nullable(),
	role: z.enum(WORKSPACE_ROLES),
	expiresAt: z.string().nullable(),
	/** Past its expiry: it holds no seat and cannot be accepted. */
	expired: z.boolean(),
	/** Whether the invited account's IdP verified its email (`account` only). */
	emailVerified: z.boolean().nullable(),
});
export type InvitationView = z.infer<typeof invitationView>;

interface StoredProfile {
	sub: string;
	username: string;
	name?: string | null;
	picture?: string | null;
	emailVerified?: boolean;
}

/** Accounts of the rows, loaded in one query. */
async function profilesOf(
	rows: readonly StoredWorkspaceMember[],
): Promise<Map<string, StoredProfile>> {
	const subs = [...new Set(rows.flatMap((row) => row.userId ?? []))];
	const users = await UserModel.find({ sub: { $in: subs } })
		.select("sub username name picture emailVerified")
		.lean<StoredProfile[]>();
	return new Map(users.map((user) => [user.sub, user]));
}

/** Views of accepted member rows as `viewerSub` sees them. */
export async function toMemberViews(
	rows: readonly StoredWorkspaceMember[],
	viewerSub: string,
): Promise<MemberView[]> {
	const profiles = await profilesOf(rows);
	return rows.flatMap((row) => {
		if (!row.userId) return [];
		const user = profiles.get(row.userId);
		return [
			{
				id: row._id.toHexString(),
				userId: row.userId,
				// A user row always exists after sign-in; fall back defensively.
				username: user?.username ?? row.userId,
				name: user?.name ?? null,
				picture: user?.picture ?? null,
				role: row.role,
				isYou: row.userId === viewerSub,
			},
		];
	});
}

export async function toMemberView(
	row: StoredWorkspaceMember,
	viewerSub: string,
): Promise<MemberView> {
	const [view] = await toMemberViews([row], viewerSub);
	if (!view) throw new Error("member view missing");
	return view;
}

export function invitationKindOf(
	row: StoredWorkspaceMember,
): InvitationView["kind"] {
	if (row.userId) return "account";
	return row.email ? "email" : "link";
}

/** Views of pending invitation rows. */
export async function toInvitationViews(
	rows: readonly StoredWorkspaceMember[],
	now: Date = new Date(),
): Promise<InvitationView[]> {
	const profiles = await profilesOf(rows);
	return rows.map((row) => {
		const user = row.userId ? profiles.get(row.userId) : undefined;
		return {
			id: row._id.toHexString(),
			kind: invitationKindOf(row),
			username: user?.username ?? null,
			email: row.email ?? null,
			role: row.role,
			expiresAt: row.expiresAt?.toISOString() ?? null,
			expired: !(row.expiresAt && row.expiresAt > now),
			emailVerified: user ? user.emailVerified === true : null,
		};
	});
}

export async function toInvitationView(
	row: StoredWorkspaceMember,
): Promise<InvitationView> {
	const [view] = await toInvitationViews([row]);
	if (!view) throw new Error("invitation view missing");
	return view;
}
