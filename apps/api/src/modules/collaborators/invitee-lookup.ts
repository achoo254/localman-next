import { OperationError } from "@localman/operations";
import type { Types } from "mongoose";
import { z } from "zod";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { CASE_INSENSITIVE_COLLATION, UserModel } from "../users/user-model.js";
import { CollaboratorModel } from "./collaborator-model.js";

/** What the owner types: a username (`@` prefix allowed) or an email. */
export const usernameOrEmailSchema = z.string().trim().min(1).max(254);

const emailSchema = z.email();

export interface InviteeAccount {
	readonly sub: string;
	readonly username: string;
	readonly name: string | null;
	readonly picture: string | null;
	readonly email: string | null;
	readonly emailVerified: boolean;
}

/**
 * Who an invitation goes to: an existing account (by username, or by an
 * email one of its accounts uses; `email` is the typed email, if any), or
 * an email nobody uses yet.
 */
export type InviteTarget =
	| {
			readonly kind: "account";
			readonly account: InviteeAccount;
			readonly email: string | null;
	  }
	| { readonly kind: "email"; readonly email: string };

/**
 * Counts one account lookup of `ownerSub`. Invitations and the dialog's
 * lookups share one budget, so neither can enumerate accounts.
 */
export async function takeInviteLookupSlot(ownerSub: string): Promise<void> {
	const window = runtimeSettings().inviteRateLimit;
	if (!(await takeRateLimitSlot("invite-lookup", ownerSub, window))) {
		throw new OperationError(
			429,
			"RATE_LIMITED",
			"Too many invitations or lookups; try again later",
		);
	}
}

interface StoredAccount {
	sub: string;
	username: string;
	name?: string | null;
	picture?: string | null;
	email?: string | null;
	emailVerified?: boolean;
}

function toAccount(user: StoredAccount): InviteeAccount {
	return {
		sub: user.sub,
		username: user.username,
		name: user.name ?? null,
		picture: user.picture ?? null,
		email: user.email ?? null,
		emailVerified: user.emailVerified === true,
	};
}

const ACCOUNT_FIELDS = "sub username name picture email emailVerified";

/**
 * The account an email invitation is bound to: the one whose IdP verified
 * the address, else the only account that merely reads it. Several
 * unverified look-alikes bind none (the invitation stays addressed to the
 * email, so only a verified owner of the address can accept it).
 */
async function accountByEmail(email: string): Promise<StoredAccount | null> {
	const verified = await UserModel.findOne({ email, emailVerified: true })
		.collation(CASE_INSENSITIVE_COLLATION)
		.select(ACCOUNT_FIELDS)
		.lean<StoredAccount>();
	if (verified) return verified;
	const unverified = await UserModel.find({ email })
		.collation(CASE_INSENSITIVE_COLLATION)
		.select(ACCOUNT_FIELDS)
		.limit(2)
		.lean<StoredAccount[]>();
	return unverified.length === 1 ? (unverified[0] ?? null) : null;
}

/**
 * Resolves what the owner typed, by exact case-insensitive match served
 * by the `username`/`email` indexes. `null`: a username nobody has.
 */
export async function resolveInviteTarget(
	typed: string,
): Promise<InviteTarget | null> {
	if (!typed.includes("@") || typed.startsWith("@")) {
		const username = typed.replace(/^@/, "");
		const user = await UserModel.findOne({ username })
			.collation(CASE_INSENSITIVE_COLLATION)
			.select(ACCOUNT_FIELDS)
			.lean<StoredAccount>();
		return user
			? { kind: "account", account: toAccount(user), email: null }
			: null;
	}
	const parsed = emailSchema.safeParse(typed.toLowerCase());
	if (!parsed.success) {
		throw new OperationError(
			400,
			"VALIDATION_ERROR",
			"Enter a username or a valid email address",
		);
	}
	const email = parsed.data;
	const user = await accountByEmail(email);
	return user
		? { kind: "account", account: toAccount(user), email }
		: { kind: "email", email };
}

/** Rows of the project that stand for the target (by account or email). */
export function targetRowsFilter(
	projectId: Types.ObjectId,
	target: InviteTarget,
): Record<string, unknown> {
	const who: Record<string, string>[] = [];
	if (target.kind === "account")
		who.push({ inviteeUserId: target.account.sub });
	if (target.email !== null) who.push({ inviteeEmail: target.email });
	return { projectId, $or: who };
}

/**
 * Whether `row` is the target's own membership. Accepted rows always name
 * their account; one that only shares the invited email belongs to
 * someone who no longer uses that address, not to the target.
 */
export function isTargetsMembership(
	row: { readonly status: string; readonly inviteeUserId?: string | null },
	target: InviteTarget,
): boolean {
	return (
		row.status === "accepted" &&
		target.kind === "account" &&
		row.inviteeUserId === target.account.sub
	);
}

/**
 * Refuses the owner themself and existing members with a clear code and
 * without their account details.
 */
export async function assertInvitable(
	project: { readonly _id: Types.ObjectId; readonly owner: string },
	target: InviteTarget,
): Promise<void> {
	if (target.kind !== "account") return;
	if (target.account.sub === project.owner) {
		throw new OperationError(
			400,
			"CANNOT_INVITE_SELF",
			"You own this project already",
		);
	}
	const member = await CollaboratorModel.exists({
		projectId: project._id,
		inviteeUserId: target.account.sub,
		status: "accepted",
	});
	if (member) throw alreadyMember();
}

export function alreadyMember(): OperationError {
	return new OperationError(
		409,
		"ALREADY_MEMBER",
		"This person is already a member of the project",
	);
}
