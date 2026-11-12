import { randomBytes } from "node:crypto";
import { SERVER_TOKEN_PREFIX, TUNNEL_SCOPES } from "@tunelo/shared";
import { hashToken } from "../auth/token-hash.js";
import { ApiKey } from "../db/models/api-key-model.js";

/**
 * TEST ONLY. A read-only link token as an anonymous machine's code
 * approval minted it before that flow was retired: it lists the tunnels of
 * `linkedDeviceId`, has no owner and no `deviceId`. Such rows still exist
 * in the database and must keep listing and revoking.
 */
export async function seedCodeLinkToken(opts: {
	linkedDeviceId: string;
	clientName: string;
}): Promise<{ token: string; id: string }> {
	const token = `${SERVER_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	const doc = await ApiKey.create({
		keyHash: hashToken(token),
		keyPrefix: token.slice(0, 12),
		label: `link:${opts.clientName}`,
		scopes: [TUNNEL_SCOPES.READ],
		linkedDeviceId: opts.linkedDeviceId,
		clientName: opts.clientName,
		status: "active",
		maxTunnels: 0,
	});
	return { token, id: String(doc._id) };
}
