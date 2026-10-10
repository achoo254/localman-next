import { randomBytes } from "node:crypto";
import { SERVER_TOKEN_PREFIX, TUNNEL_SCOPES } from "@tunelo/shared";
import { hashToken } from "../auth/token-hash.js";
import { ApiKey, FULL_RIGHTS_FILTER } from "../db/models/api-key-model.js";

interface MintedToken {
	token: string;
	keyPrefix: string;
}

function mintToken(): MintedToken {
	const token = `${SERVER_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	return { token, keyPrefix: token.slice(0, 12) };
}

/**
 * Mints a standalone access token, stores its hash, and returns the plaintext
 * ONCE. No user account is involved — the token is the credential.
 *
 * When `deviceId` is given, the device's prior active full-rights tokens are
 * revoked first, so a device keeps exactly one across re-logins. Link tokens
 * (scoped, never carrying `deviceId`) are deliberately left alone: logging in
 * again must not unlink Localman.
 */
export async function issueAccessToken(
	label: string,
	opts: { deviceId?: string; maxTunnels?: number } = {},
): Promise<MintedToken> {
	const { deviceId = null, maxTunnels = 3 } = opts;

	if (deviceId) {
		await ApiKey.updateMany(
			{ deviceId, status: "active", ...FULL_RIGHTS_FILTER },
			{ $set: { status: "revoked" } },
		);
	}

	const minted = mintToken();
	await ApiKey.create({
		keyHash: hashToken(minted.token),
		keyPrefix: minted.keyPrefix,
		label,
		deviceId,
		status: "active",
		maxTunnels,
	});
	return minted;
}

/**
 * Mints a read-only link token: it lists the tunnels of `linkedDeviceId` and
 * nothing else. No `deviceId`, so device re-login never revokes it.
 */
export async function issueLinkToken(opts: {
	linkedDeviceId: string;
	clientName: string;
}): Promise<MintedToken & { id: string }> {
	const minted = mintToken();
	const doc = await ApiKey.create({
		keyHash: hashToken(minted.token),
		keyPrefix: minted.keyPrefix,
		label: `link:${opts.clientName}`,
		scopes: [TUNNEL_SCOPES.READ],
		linkedDeviceId: opts.linkedDeviceId,
		clientName: opts.clientName,
		status: "active",
		maxTunnels: 0,
	});
	return { ...minted, id: String(doc._id) };
}
