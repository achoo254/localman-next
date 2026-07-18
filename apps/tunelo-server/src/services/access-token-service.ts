import { createHash, randomBytes } from "node:crypto";
import { ApiKey } from "../db/models/api-key-model.js";

const TOKEN_PREFIX = "tunelo_";

function hash(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/**
 * Mints a standalone access token, stores its hash, and returns the plaintext
 * ONCE. No user account is involved — the token is the credential.
 */
export async function issueAccessToken(
	label: string,
	maxTunnels = 3,
): Promise<{ token: string; keyPrefix: string }> {
	const token = `${TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
	const keyPrefix = token.slice(0, 12);
	await ApiKey.create({
		keyHash: hash(token),
		keyPrefix,
		label,
		status: "active",
		maxTunnels,
	});
	return { token, keyPrefix };
}
