import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	expectBoolean,
	expectRecord,
	expectString,
	optionalString,
} from "../../lib/json-guards";

/** Why the signed-in account cannot accept, as `mock.previewInvite` says. */
export type IneligibleReason =
	| "NOT_INVITEE"
	| "EMAIL_NOT_VERIFIED"
	| "ALREADY_MEMBER"
	| "MEMBER_LIMIT";

const REASONS: readonly IneligibleReason[] = [
	"NOT_INVITEE",
	"EMAIL_NOT_VERIFIED",
	"ALREADY_MEMBER",
	"MEMBER_LIMIT",
];

export interface InvitePreview {
	/** `invite`: one-time invitation; `magic`: the project's reusable link. */
	kind: "invite" | "magic";
	project: { id: string; name: string };
	inviter: { username: string; name: string | null; picture: string | null };
	expiresAt: string | null;
	/** Invited email, masked (`t***@example.com`); null for magic links. */
	inviteeEmail: string | null;
	eligible: boolean;
	reason: IneligibleReason | null;
}

export interface AcceptedInvite {
	projectId: string;
	alreadyMember: boolean;
}

/** The token travels in the body, never in an API URL. */
export async function previewInvite(token: string): Promise<InvitePreview> {
	const data = expectRecord(
		await apiRequest("/api/v1/invites/preview", {
			method: "POST",
			body: { token },
		}),
		"invite preview",
	);
	const kind = data.kind;
	if (kind !== "invite" && kind !== "magic") {
		throw new InvalidResponseError("invite kind");
	}
	const reason =
		data.reason === null ? null : REASONS.find((r) => r === data.reason);
	if (reason === undefined) throw new InvalidResponseError("invite reason");
	const project = expectRecord(data.project, "project");
	const inviter = expectRecord(data.inviter, "inviter");
	return {
		kind,
		project: {
			id: expectString(project, "id"),
			name: expectString(project, "name"),
		},
		inviter: {
			username: expectString(inviter, "username"),
			name: optionalString(inviter, "name"),
			picture: optionalString(inviter, "picture"),
		},
		expiresAt: optionalString(data, "expiresAt"),
		inviteeEmail: optionalString(data, "inviteeEmail"),
		eligible: expectBoolean(data, "eligible"),
		reason,
	};
}

export async function acceptInvite(token: string): Promise<AcceptedInvite> {
	const data = expectRecord(
		await apiRequest("/api/v1/invites/accept", {
			method: "POST",
			body: { token },
		}),
		"accepted invite",
	);
	return {
		projectId: expectString(data, "projectId"),
		alreadyMember: data.alreadyMember === true,
	};
}
