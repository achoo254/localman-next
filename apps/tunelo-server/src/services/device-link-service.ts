import { TUNNEL_SCOPES } from "@tunelo/shared";
import { isValidObjectId } from "mongoose";
import { TuneloError } from "../api/middleware/error-handler.js";
import { ApiKey } from "../db/models/api-key-model.js";

/**
 * Read-only links an anonymous machine approved with a code, before only
 * an account's own machines could be linked: no owner. Nothing mints them
 * any more; they are listed and revoked until none is left.
 */
const LINK_TOKEN_FILTER = {
	status: "active" as const,
	scopes: TUNNEL_SCOPES.READ,
	linkedOwnerSub: null,
};

export async function listLinks(deviceId: string): Promise<
	{
		id: string;
		clientName: string;
		createdAt: string | null;
		lastUsedAt: string | null;
	}[]
> {
	const rows = await ApiKey.find({
		linkedDeviceId: deviceId,
		...LINK_TOKEN_FILTER,
	})
		.sort({ createdAt: -1 })
		.lean();
	return rows.map((row) => ({
		id: String(row._id),
		clientName: row.clientName ?? "",
		createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
		lastUsedAt: row.lastUsedAt ? new Date(row.lastUsedAt).toISOString() : null,
	}));
}

/** The machine revokes one of its links. */
export async function revokeLink(deviceId: string, id: string): Promise<void> {
	const result = isValidObjectId(id)
		? await ApiKey.updateOne(
				{ _id: id, linkedDeviceId: deviceId, ...LINK_TOKEN_FILTER },
				{ $set: { status: "revoked" } },
			)
		: null;
	if (!result || result.matchedCount === 0) {
		throw new TuneloError("TUNELO_LINK_003", "Link not found", 404);
	}
}

/** A link token (an older code link or an account's own) revokes itself. */
export async function revokeOwnLink(keyId: string): Promise<void> {
	await ApiKey.updateOne(
		{ _id: keyId, status: "active", scopes: TUNNEL_SCOPES.READ },
		{ $set: { status: "revoked" } },
	);
}
