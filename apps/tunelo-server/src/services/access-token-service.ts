import { createHash, randomBytes } from "node:crypto";
import { ApiKey } from "../db/models/api-key-model.js";

const TOKEN_PREFIX = "tunelo_";

function hash(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/**
 * Mints a standalone access token, stores its hash, and returns the plaintext
 * ONCE. No user account is involved — the token is the credential.
 *
 * When `deviceId` is given, any prior active tokens for that device are revoked
 * first, so a device keeps exactly one active token across re-logins.
 */
export async function issueAccessToken(
	label: string,
	opts: { deviceId?: string; maxTunnels?: number } = {},
): Promise<{ token: string; keyPrefix: string }> {
	const { deviceId = null, maxTunnels = 3 } = opts;

	if (deviceId) {
		await ApiKey.updateMany(
			{ deviceId, status: "active" },
			{ $set: { status: "revoked" } },
		);
	}

	const token = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	const keyPrefix = token.slice(0, 12);
	await ApiKey.create({
		keyHash: hash(token),
		keyPrefix,
		label,
		deviceId,
		status: "active",
		maxTunnels,
	});
	return { token, keyPrefix };
}
