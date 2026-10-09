import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import type { StoredCollaborator } from "./collaborator-model.js";

export const memberProfile = z.object({
	sub: z.string(),
	username: z.string(),
	name: z.string().nullable(),
	picture: z.string().nullable(),
});

export const collaboratorView = z.object({
	id: z.string(),
	/** `expired`: a pending invitation past its expiry; it holds no seat. */
	status: z.enum(["pending", "accepted", "expired"]),
	/** The invited email; shown to the owner only, `null` otherwise. */
	inviteeEmail: z.string().nullable(),
	/** The account, once bound (invitation by account, or accepted). */
	user: memberProfile.extend({ emailVerified: z.boolean() }).nullable(),
	invitedAt: z.string(),
	acceptedAt: z.string().nullable(),
	/** Expiry of a pending or expired invitation; `null` once accepted. */
	expiresAt: z.string().nullable(),
});
export type CollaboratorView = z.infer<typeof collaboratorView>;

interface StoredProfile {
	sub: string;
	username: string;
	name?: string | null;
	picture?: string | null;
	emailVerified?: boolean;
}

export interface ViewOptions {
	/** Owners see invited emails; collaborators never do. */
	readonly showEmails: boolean;
	readonly now?: Date;
}

/** Views of collaborator rows, their accounts loaded in one query. */
export async function toCollaboratorViews(
	rows: readonly StoredCollaborator[],
	options: ViewOptions,
): Promise<CollaboratorView[]> {
	const now = options.now ?? new Date();
	const subs = [
		...new Set(
			rows.flatMap((row) => (row.inviteeUserId ? [row.inviteeUserId] : [])),
		),
	];
	const users = await UserModel.find({ sub: { $in: subs } })
		.select("sub username name picture emailVerified")
		.lean<StoredProfile[]>();
	const bySub = new Map(users.map((user) => [user.sub, user]));
	return rows.map((row) => {
		const user = row.inviteeUserId ? bySub.get(row.inviteeUserId) : undefined;
		const accepted = row.status === "accepted";
		const expired = !accepted && !(row.expiresAt && row.expiresAt > now);
		return {
			id: row._id.toHexString(),
			status: accepted ? "accepted" : expired ? "expired" : "pending",
			inviteeEmail: options.showEmails ? (row.inviteeEmail ?? null) : null,
			user: user
				? {
						sub: user.sub,
						username: user.username,
						name: user.name ?? null,
						picture: user.picture ?? null,
						emailVerified: user.emailVerified === true,
					}
				: null,
			invitedAt: row.createdAt.toISOString(),
			acceptedAt: row.acceptedAt?.toISOString() ?? null,
			expiresAt: accepted ? null : (row.expiresAt?.toISOString() ?? null),
		};
	});
}

export async function toCollaboratorView(
	row: StoredCollaborator,
	options: ViewOptions,
): Promise<CollaboratorView> {
	const [view] = await toCollaboratorViews([row], options);
	if (!view) throw new Error("collaborator view missing");
	return view;
}
