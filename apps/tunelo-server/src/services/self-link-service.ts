import { randomBytes } from "node:crypto";
import {
	LOCAL_FORWARD,
	SERVER_TOKEN_PREFIX,
	TUNNEL_SCOPES,
} from "@tunelo/shared";
import { isValidObjectId } from "mongoose";
import { TuneloError } from "../api/middleware/error-handler.js";
import { hashToken } from "../auth/token-hash.js";
import { buildTunnelUrl } from "../config/tunnel-domains.js";
import { ApiKey } from "../db/models/api-key-model.js";
import { machineSubdomain } from "../machine-subdomain.js";

/** Scopes of a link an account mints for one of its own machines. */
export const SELF_LINK_SCOPES = [TUNNEL_SCOPES.READ, LOCAL_FORWARD.SCOPE];

/** Where the linked app sends requests for the machine's loopback. */
export function forwardUrlOf(ownerSub: string, deviceId: string): string {
	return `${buildTunnelUrl(machineSubdomain(ownerSub, deviceId))}${LOCAL_FORWARD.PATH}`;
}

export interface SelfLink {
	token: string;
	linkId: string;
	forwardUrl: string;
}

/**
 * Mints the link token an app (Localman) uses for one machine of the
 * account: it lists that machine's tunnels and forwards to its loopback.
 * The machine's earlier link for the same app is revoked first, so signing
 * in again leaves one live token per machine and app.
 */
export async function issueSelfLink(input: {
	ownerSub: string;
	deviceId: string;
	clientName: string;
}): Promise<SelfLink> {
	const { ownerSub, deviceId, clientName } = input;
	await ApiKey.updateMany(
		{
			linkedOwnerSub: ownerSub,
			linkedDeviceId: deviceId,
			clientName,
			status: "active",
		},
		{ $set: { status: "revoked" } },
	);
	const token = `${SERVER_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	const doc = await ApiKey.create({
		keyHash: hashToken(token),
		keyPrefix: token.slice(0, 12),
		label: `link:${clientName}`,
		scopes: SELF_LINK_SCOPES,
		linkedDeviceId: deviceId,
		linkedOwnerSub: ownerSub,
		clientName,
		status: "active",
		maxTunnels: 0,
	});
	return {
		token,
		linkId: String(doc._id),
		forwardUrl: forwardUrlOf(ownerSub, deviceId),
	};
}

const ACTIVE_SELF_LINK = {
	status: "active" as const,
	scopes: LOCAL_FORWARD.SCOPE,
};

export interface AccountLinkRow {
	id: string;
	deviceId: string;
	clientName: string;
	createdAt: string | null;
	lastUsedAt: string | null;
}

/** Live links an account made for its machines (`tunelo` lists them). */
export async function listAccountLinks(
	ownerSub: string,
): Promise<AccountLinkRow[]> {
	const rows = await ApiKey.find({
		linkedOwnerSub: ownerSub,
		...ACTIVE_SELF_LINK,
	})
		.sort({ createdAt: -1 })
		.lean();
	return rows.map((row) => ({
		id: String(row._id),
		deviceId: row.linkedDeviceId ?? "",
		clientName: row.clientName ?? "",
		createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
		lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
	}));
}

/** The account revokes one of its machines' links. */
export async function revokeAccountLink(
	ownerSub: string,
	id: string,
): Promise<void> {
	const result = isValidObjectId(id)
		? await ApiKey.updateOne(
				{ _id: id, linkedOwnerSub: ownerSub, ...ACTIVE_SELF_LINK },
				{ $set: { status: "revoked" } },
			)
		: null;
	if (!result || result.matchedCount === 0) {
		throw new TuneloError("TUNELO_LINK_003", "Link not found", 404);
	}
}
