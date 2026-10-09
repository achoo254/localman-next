import { z } from "zod";
import { inProjectTransaction } from "../projects/project-lock.js";
import type { StoredProject } from "../projects/project-model.js";
import { inviteLinkOf, issueInviteToken } from "./invite-token.js";
import { MagicLinkModel, type StoredMagicLink } from "./magic-link-model.js";

/**
 * Magic link of a project: a reusable invite link. Anyone signed in who
 * opens it joins as an accepted collaborator, within the owner's member
 * limit (checked when joining; the link itself holds no seat). At most one
 * working link per project, valid 7 days. Only its SHA-256 is stored, so
 * the link is shown once, when created; afterwards the owner sees its
 * state and can replace or revoke it. Joining is `acceptToken`.
 */

export const magicLinkState = z.object({
	status: z.enum(["none", "active", "expired", "revoked"]),
	expiresAt: z.string().nullable(),
	/** When the current link was created (or last replaced). */
	createdAt: z.string().nullable(),
});
export type MagicLinkState = z.infer<typeof magicLinkState>;

function stateOf(link: StoredMagicLink | null, now: Date): MagicLinkState {
	if (!link) return { status: "none", expiresAt: null, createdAt: null };
	const status = link.revokedAt
		? "revoked"
		: link.expiresAt <= now
			? "expired"
			: "active";
	return {
		status,
		expiresAt: link.expiresAt.toISOString(),
		createdAt: link.issuedAt.toISOString(),
	};
}

export async function getMagicLinkState(
	project: StoredProject,
): Promise<MagicLinkState> {
	const link = await MagicLinkModel.findOne({
		projectId: project._id,
	}).lean<StoredMagicLink>();
	return stateOf(link, new Date());
}

/**
 * Creates the project's magic link, replacing (and so revoking) the
 * previous one. Written under the project lock, so a project being
 * deleted never gets a link after its cleanup ran.
 */
export async function rotateMagicLink(
	project: StoredProject,
	ownerSub: string,
): Promise<MagicLinkState & { link: string }> {
	const issued = issueInviteToken();
	const link = await inProjectTransaction(project._id, async (session) =>
		MagicLinkModel.findOneAndUpdate(
			{ projectId: project._id },
			{
				$set: {
					tokenHash: issued.tokenHash,
					expiresAt: issued.expiresAt,
					revokedAt: null,
					createdBy: ownerSub,
					issuedAt: new Date(),
				},
			},
			{ upsert: true, returnDocument: "after", session },
		).lean<StoredMagicLink>(),
	);
	return { ...stateOf(link, new Date()), link: inviteLinkOf(issued.token) };
}

/** Revokes the working link, if any. Members who joined stay members. */
export async function revokeMagicLink(
	project: StoredProject,
): Promise<MagicLinkState> {
	await MagicLinkModel.updateOne(
		{ projectId: project._id, revokedAt: null },
		{ $set: { revokedAt: new Date() } },
	);
	return getMagicLinkState(project);
}
