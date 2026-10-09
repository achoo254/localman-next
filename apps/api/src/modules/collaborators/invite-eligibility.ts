import { OperationError } from "@localman/operations";
import { runtimeSettings } from "../../config/runtime-settings.js";
import {
	clientIpBucket,
	takeRateLimitSlot,
} from "../../lib/rate-limit-windows.js";
import { can } from "../projects/project-access.js";
import {
	type StoredProject,
	findProjectById,
} from "../projects/project-model.js";
import { UserModel } from "../users/user-model.js";
import { callerRows, verifiedEmailOf } from "./caller-rows.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
	holdsSeat,
} from "./collaborator-model.js";
import { hashInviteToken } from "./invite-token.js";
import { MagicLinkModel, type StoredMagicLink } from "./magic-link-model.js";
import { memberSeats } from "./member-seats.js";

export const INELIGIBLE_REASONS = [
	"NOT_INVITEE",
	"EMAIL_NOT_VERIFIED",
	"ALREADY_MEMBER",
	"MEMBER_LIMIT",
] as const;
export type IneligibleReason = (typeof INELIGIBLE_REASONS)[number];

/** A token of a one-time invitation or of a project's magic link. */
export type ResolvedToken =
	| {
			readonly kind: "invite";
			readonly project: StoredProject;
			readonly row: StoredCollaborator;
	  }
	| {
			readonly kind: "magic";
			readonly project: StoredProject;
			readonly link: StoredMagicLink;
	  };

export function inviterOf(token: ResolvedToken): string {
	return token.kind === "invite" ? token.row.invitedBy : token.link.createdBy;
}

export function expiryOf(token: ResolvedToken): Date | null {
	return token.kind === "invite"
		? (token.row.expiresAt ?? null)
		: token.link.expiresAt;
}

const inviteNotFound = (): OperationError =>
	new OperationError(404, "INVITE_NOT_FOUND", "This invite link is not valid");

/**
 * Counts one preview or accept per account and per client IP: tokens have
 * 256 bits, and the limit also keeps anyone from hammering the lookups.
 */
export async function takeInviteTokenSlot(
	sub: string,
	clientIp: string | null,
): Promise<void> {
	const limits = runtimeSettings().inviteTokenRateLimit;
	const userOk = await takeRateLimitSlot(
		"invite-token:user",
		sub,
		limits.perUser,
	);
	const ipOk = await takeRateLimitSlot(
		"invite-token:ip",
		clientIpBucket(clientIp),
		limits.perIp,
	);
	if (!userOk || !ipOk) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many invite links opened; try again later",
		);
	}
}

/**
 * The invitation or magic link a token belongs to. Unknown tokens, tokens
 * replaced by a newer magic link and tokens of deleted projects (or ones
 * being deleted) are all `INVITE_NOT_FOUND`. A token only ever leads to
 * its own project: the project comes from the stored token, never from
 * the request.
 */
export async function resolveToken(token: string): Promise<ResolvedToken> {
	const tokenHash = hashInviteToken(token);
	const row = await CollaboratorModel.findOne({
		inviteTokenHash: tokenHash,
	}).lean<StoredCollaborator>();
	const link = row
		? null
		: await MagicLinkModel.findOne({ tokenHash }).lean<StoredMagicLink>();
	const projectId = row?.projectId ?? link?.projectId;
	const project = projectId
		? await findProjectById(projectId.toHexString())
		: null;
	if (!project) throw inviteNotFound();
	if (row) return { kind: "invite", project, row };
	if (link) return { kind: "magic", project, link };
	throw inviteNotFound();
}

/** Throws when the token can no longer be used by anyone. */
function assertUsable(token: ResolvedToken, now: Date): void {
	if (token.kind === "magic" && token.link.revokedAt) {
		throw new OperationError(
			410,
			"INVITE_REVOKED",
			"The owner revoked this link",
		);
	}
	if (token.kind === "invite" && token.row.status === "accepted") {
		throw new OperationError(
			410,
			"INVITE_USED",
			"This invite link was already used",
		);
	}
	const expiresAt = expiryOf(token);
	if (!expiresAt || expiresAt <= now) {
		throw new OperationError(
			410,
			"INVITE_EXPIRED",
			"This invite link expired",
			{
				expiresAt: expiresAt?.toISOString() ?? null,
			},
		);
	}
}

/**
 * Who may accept an invitation (a magic link admits anyone signed in):
 * - an invitation bound to an account: that account only;
 * - an invitation to an email without an account: an account whose email
 *   the IdP verified (Google/GitHub) and that equals it, lower-cased. An
 *   unverified email that merely reads the same is not enough, or anyone
 *   could register the address and take the seat.
 */
async function addresseeProblem(
	sub: string,
	row: StoredCollaborator,
): Promise<IneligibleReason | null> {
	if (row.inviteeUserId) {
		return row.inviteeUserId === sub ? null : "NOT_INVITEE";
	}
	const user = await UserModel.findOne({ sub })
		.select("email emailVerified")
		.lean<{ email?: string | null; emailVerified?: boolean }>();
	const email = user?.email?.trim().toLowerCase();
	if (!row.inviteeEmail || email !== row.inviteeEmail) return "NOT_INVITEE";
	return user?.emailVerified === true ? null : "EMAIL_NOT_VERIFIED";
}

/** Seats the caller would add: none if one of their rows holds one. */
async function seatsToAdd(
	sub: string,
	token: ResolvedToken,
	now: Date,
): Promise<number> {
	if (token.kind === "invite") return 0;
	const [own] = await callerRows(
		token.project._id,
		sub,
		await verifiedEmailOf(sub),
	);
	return own && holdsSeat(own, now) ? 0 : 1;
}

/**
 * Why `sub` cannot accept the token, or `null` when they can. Members and
 * the owner are told so before the token's own state is checked, so they
 * can be sent to the project even from a used or expired link. Throws the
 * token errors (`INVITE_REVOKED`, `INVITE_USED`, `INVITE_EXPIRED`).
 */
export async function ineligibility(
	sub: string,
	token: ResolvedToken,
	now: Date = new Date(),
): Promise<IneligibleReason | null> {
	if (await can({ sub }, "read", token.project)) return "ALREADY_MEMBER";
	assertUsable(token, now);
	if (token.kind === "invite") {
		const problem = await addresseeProblem(sub, token.row);
		if (problem) return problem;
	}
	const seats = await memberSeats(token.project, null, now);
	const adding = await seatsToAdd(sub, token, now);
	return seats.used + adding > seats.max ? "MEMBER_LIMIT" : null;
}
