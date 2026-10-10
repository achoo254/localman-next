import type { WorkspaceRole } from "@localman/shared/access";
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
import { parseRole, workspacePath } from "./workspaces-api";

export interface WorkspaceMember {
	id: string;
	userId: string;
	username: string;
	name: string | null;
	picture: string | null;
	role: WorkspaceRole;
	isYou: boolean;
}

export type InvitationKind = "account" | "email" | "link";

export interface WorkspaceInvitation {
	id: string;
	/** account: bound to an account; email: an address; link: one-use link. */
	kind: InvitationKind;
	username: string | null;
	email: string | null;
	role: WorkspaceRole;
	expiresAt: string | null;
	/** Past its expiry: holds no seat, cannot be accepted. */
	expired: boolean;
	/** Whether the invited account's email is verified (`account` only). */
	emailVerified: boolean | null;
}

export interface WorkspaceMemberList {
	members: WorkspaceMember[];
	/** Listed to Admins only; empty for other roles. */
	invitations: WorkspaceInvitation[];
	/** null for a personal workspace; `max` null means no cap. */
	seats: { used: number; max: number | null } | null;
}

export interface IssuedInvitation {
	invitation: WorkspaceInvitation;
	/** `/workspace-invite/:token`, shown once: never returned again. */
	inviteLink: string;
	notified: boolean;
}

const KINDS: readonly InvitationKind[] = ["account", "email", "link"];

export function parseInvitationKind(value: unknown): InvitationKind {
	const kind = KINDS.find((k) => k === value);
	if (!kind) throw new InvalidResponseError("invitation kind");
	return kind;
}

function parseMember(value: unknown): WorkspaceMember {
	const data = expectRecord(value, "member");
	return {
		id: expectString(data, "id"),
		userId: expectString(data, "userId"),
		username: expectString(data, "username"),
		name: optionalString(data, "name"),
		picture: optionalString(data, "picture"),
		role: parseRole(data.role, "member role"),
		isYou: expectBoolean(data, "isYou"),
	};
}

function parseInvitation(value: unknown): WorkspaceInvitation {
	const data = expectRecord(value, "invitation");
	return {
		id: expectString(data, "id"),
		kind: parseInvitationKind(data.kind),
		username: optionalString(data, "username"),
		email: optionalString(data, "email"),
		role: parseRole(data.role, "invitation role"),
		expiresAt: optionalString(data, "expiresAt"),
		expired: expectBoolean(data, "expired"),
		emailVerified:
			data.emailVerified === null || data.emailVerified === undefined
				? null
				: expectBoolean(data, "emailVerified"),
	};
}

/**
 * A `/workspace-invite/:token` path from the API. Anything else is refused
 * before it is joined to the app origin and shown or copied as a link.
 */
function expectWorkspaceInvitePath(record: JsonRecord, key: string): string {
	const path = expectString(record, key);
	if (!/^\/workspace-invite\/[A-Za-z0-9_-]+$/.test(path)) {
		throw new InvalidResponseError(key);
	}
	return path;
}

function parseIssued(value: unknown): IssuedInvitation {
	const data = expectRecord(value, "issued invitation");
	return {
		invitation: parseInvitation(data.invitation),
		inviteLink: expectWorkspaceInvitePath(data, "inviteLink"),
		notified: data.notified === true,
	};
}

const membersPath = (workspaceId: string) =>
	`${workspacePath(workspaceId)}/members`;

export async function fetchWorkspaceMembers(
	workspaceId: string,
): Promise<WorkspaceMemberList> {
	const data = expectRecord(
		await apiRequest(membersPath(workspaceId)),
		"member list",
	);
	const seats = data.seats === null ? null : expectRecord(data.seats, "seats");
	return {
		members: expectArray(data, "members").map(parseMember),
		invitations: expectArray(data, "invitations").map(parseInvitation),
		seats: seats
			? {
					used: expectNumber(seats, "used"),
					max: seats.max === null ? null : expectNumber(seats, "max"),
				}
			: null,
	};
}

export async function updateMemberRole(
	workspaceId: string,
	memberId: string,
	role: WorkspaceRole,
): Promise<WorkspaceMember> {
	const data = expectRecord(
		await apiRequest(
			`${membersPath(workspaceId)}/${encodeURIComponent(memberId)}`,
			{ method: "PATCH", body: { role } },
		),
		"role change",
	);
	return parseMember(data.member);
}

export async function removeWorkspaceMember(
	workspaceId: string,
	memberId: string,
): Promise<void> {
	await apiRequest(
		`${membersPath(workspaceId)}/${encodeURIComponent(memberId)}`,
		{ method: "DELETE" },
	);
}

export async function leaveWorkspace(workspaceId: string): Promise<void> {
	await apiRequest(`${workspacePath(workspaceId)}/leave`, { method: "POST" });
}

export async function inviteWorkspaceMember(
	workspaceId: string,
	usernameOrEmail: string,
	role: WorkspaceRole,
): Promise<IssuedInvitation> {
	return parseIssued(
		await apiRequest(`${workspacePath(workspaceId)}/invitations`, {
			method: "POST",
			body: { usernameOrEmail, role },
		}),
	);
}

export async function createWorkspaceInviteLink(
	workspaceId: string,
	role: WorkspaceRole,
): Promise<IssuedInvitation> {
	return parseIssued(
		await apiRequest(`${workspacePath(workspaceId)}/invite-links`, {
			method: "POST",
			body: { role },
		}),
	);
}

export async function revokeWorkspaceInvitation(
	workspaceId: string,
	invitationId: string,
): Promise<void> {
	await apiRequest(
		`${workspacePath(workspaceId)}/invitations/${encodeURIComponent(invitationId)}`,
		{ method: "DELETE" },
	);
}
