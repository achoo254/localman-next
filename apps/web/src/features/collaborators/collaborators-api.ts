import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectArray,
	expectBoolean,
	expectNumber,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

export interface MemberProfile {
	sub: string;
	username: string;
	name: string | null;
	picture: string | null;
}

/** `expired`: a pending invitation past its expiry; it holds no seat. */
export type CollaboratorStatus = "pending" | "accepted" | "expired";

export interface Collaborator {
	id: string;
	status: CollaboratorStatus;
	/** The invited email; the owner sees it, collaborators get null. */
	inviteeEmail: string | null;
	/** The account, once bound (invitation by account, or accepted). */
	user: (MemberProfile & { emailVerified: boolean }) | null;
	invitedAt: string;
	acceptedAt: string | null;
	expiresAt: string | null;
}

export interface CollaboratorList {
	owner: MemberProfile;
	/** Owner, accepted members and pending invitations; `max` null = no cap. */
	seats: { used: number; max: number | null };
	/** The caller owns the project: may invite, remove and manage the link. */
	canManage: boolean;
	items: Collaborator[];
}

/** Account an invitation would go to, as the invite dialog shows it. */
export interface Invitee {
	username: string;
	name: string | null;
	picture: string | null;
	maskedEmail: string | null;
	emailVerified: boolean;
}

export interface InviteResult {
	collaborator: Collaborator;
	/** `/invite/:token`, shown once: the API never returns it again. */
	inviteLink: string;
	invitee: Invitee | null;
	notified: boolean;
}

const STATUSES: readonly CollaboratorStatus[] = [
	"pending",
	"accepted",
	"expired",
];

const membersPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/collaborators`;

function parseProfile(data: JsonRecord): MemberProfile {
	return {
		sub: expectString(data, "sub"),
		username: expectString(data, "username"),
		name: optionalString(data, "name"),
		picture: optionalString(data, "picture"),
	};
}

export function parseCollaborator(value: unknown): Collaborator {
	const data = expectRecord(value, "collaborator");
	const status = STATUSES.find((s) => s === data.status);
	if (!status) throw new InvalidResponseError("collaborator status");
	const user = data.user === null ? null : expectRecord(data.user, "user");
	return {
		id: expectString(data, "id"),
		status,
		inviteeEmail: optionalString(data, "inviteeEmail"),
		user: user
			? { ...parseProfile(user), emailVerified: user.emailVerified === true }
			: null,
		invitedAt: expectString(data, "invitedAt"),
		acceptedAt: optionalString(data, "acceptedAt"),
		expiresAt: optionalString(data, "expiresAt"),
	};
}

function parseInvitee(value: unknown): Invitee | null {
	if (value === null || value === undefined) return null;
	const data = expectRecord(value, "invitee");
	return {
		username: expectString(data, "username"),
		name: optionalString(data, "name"),
		picture: optionalString(data, "picture"),
		maskedEmail: optionalString(data, "maskedEmail"),
		emailVerified: expectBoolean(data, "emailVerified"),
	};
}

export async function fetchCollaborators(
	projectId: string,
): Promise<CollaboratorList> {
	const data = expectRecord(
		await apiRequest(membersPath(projectId)),
		"collaborator list",
	);
	const seats = expectRecord(data.seats, "seats");
	return {
		owner: parseProfile(expectRecord(data.owner, "owner")),
		seats: {
			used: expectNumber(seats, "used"),
			max: seats.max === null ? null : expectNumber(seats, "max"),
		},
		canManage: expectBoolean(data, "canManage"),
		items: expectArray(data, "items").map(parseCollaborator),
	};
}

/** Exact username or email match; null when no account matches. */
export async function lookupInvitee(
	projectId: string,
	usernameOrEmail: string,
): Promise<Invitee | null> {
	const data = expectRecord(
		await apiRequest(`${membersPath(projectId)}/lookup`, {
			method: "POST",
			body: { usernameOrEmail },
		}),
		"invitee lookup",
	);
	return parseInvitee(data.match);
}

export async function inviteCollaborator(
	projectId: string,
	usernameOrEmail: string,
): Promise<InviteResult> {
	const data = expectRecord(
		await apiRequest(membersPath(projectId), {
			method: "POST",
			body: { usernameOrEmail },
		}),
		"invitation",
	);
	return {
		collaborator: parseCollaborator(data.collaborator),
		inviteLink: expectInvitePath(data, "inviteLink"),
		invitee: parseInvitee(data.invitee),
		notified: data.notified === true,
	};
}

/** Removes a member or invitation (owner), or leaves the project (self). */
export async function removeCollaborator(
	projectId: string,
	collaboratorId: string,
): Promise<void> {
	await apiRequest(
		`${membersPath(projectId)}/${encodeURIComponent(collaboratorId)}`,
		{ method: "DELETE" },
	);
}

/**
 * An `/invite/:token` path from the API. Anything else is refused before
 * it is joined to the app origin and shown or copied as a link.
 */
export function expectInvitePath(record: JsonRecord, key: string): string {
	const path = expectString(record, key);
	if (!/^\/invite\/[A-Za-z0-9_-]+$/.test(path)) {
		throw new InvalidResponseError(key);
	}
	return path;
}
