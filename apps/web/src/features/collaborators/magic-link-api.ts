import { apiRequest } from "../../lib/api-client";
import {
	InvalidResponseError,
	type JsonRecord,
	expectRecord,
	optionalString,
} from "../../lib/json-guards";
import { expectInvitePath } from "./collaborators-api";

export type MagicLinkStatus = "none" | "active" | "expired" | "revoked";

export interface MagicLinkState {
	status: MagicLinkStatus;
	expiresAt: string | null;
	/** When the current link was created (or last replaced). */
	createdAt: string | null;
}

/** State right after creating a link: the only time the link is returned. */
export interface CreatedMagicLink extends MagicLinkState {
	/** `/invite/:token`. */
	link: string;
}

const STATUSES: readonly MagicLinkStatus[] = [
	"none",
	"active",
	"expired",
	"revoked",
];

const linkPath = (projectId: string) =>
	`/api/v1/projects/${encodeURIComponent(projectId)}/magic-link`;

function parseState(data: JsonRecord): MagicLinkState {
	const status = STATUSES.find((s) => s === data.status);
	if (!status) throw new InvalidResponseError("magic link status");
	return {
		status,
		expiresAt: optionalString(data, "expiresAt"),
		createdAt: optionalString(data, "createdAt"),
	};
}

export async function fetchMagicLink(
	projectId: string,
): Promise<MagicLinkState> {
	return parseState(
		expectRecord(await apiRequest(linkPath(projectId)), "magic link"),
	);
}

/** Creates the project's link, replacing (and so stopping) the previous one. */
export async function createMagicLink(
	projectId: string,
): Promise<CreatedMagicLink> {
	const data = expectRecord(
		await apiRequest(linkPath(projectId), { method: "POST" }),
		"magic link",
	);
	return { ...parseState(data), link: expectInvitePath(data, "link") };
}

export async function revokeMagicLink(
	projectId: string,
): Promise<MagicLinkState> {
	return parseState(
		expectRecord(
			await apiRequest(linkPath(projectId), { method: "DELETE" }),
			"magic link",
		),
	);
}
