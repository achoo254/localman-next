import { createHash, timingSafeEqual } from "node:crypto";
import mongoose, { Schema, type Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { issuePrefixedToken } from "../../lib/prefixed-token.js";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";
import { registerProjectDependent } from "../projects/project-dependents.js";

/** Prefix of a Hosted Mock MCP token, so leaked tokens are recognizable. */
export const MCP_TOKEN_PREFIX = "lmmcp_";

/**
 * The "Require a token for MCP" setting of a project's Hosted Mock MCP
 * endpoint, one document per project. Only the SHA-256 of the token is
 * stored, with its last characters and creation time for display: the
 * token itself is shown once, when it is created. Turning the setting
 * off keeps the token, so turning it back on restores the same one.
 */
const mcpTokenSchema = new Schema(
	{
		projectId: { type: Schema.Types.ObjectId, required: true, unique: true },
		required: { type: Boolean, required: true, default: false },
		tokenHash: { type: String, default: null },
		tokenLast4: { type: String, default: null },
		tokenCreatedAt: { type: Date, default: null },
	},
	{ collection: "mcp_tokens", timestamps: true, versionKey: false },
);

mcpTokenSchema.plugin(tenantScopePlugin);
export const McpTokenModel = mongoose.model("McpToken", mcpTokenSchema);

export interface StoredMcpToken {
	readonly projectId: Types.ObjectId;
	readonly required: boolean;
	readonly tokenHash: string | null;
	readonly tokenLast4: string | null;
	readonly tokenCreatedAt: Date | null;
}

function sha256(text: string): Buffer {
	return createHash("sha256").update(text, "utf8").digest();
}

export interface IssuedMcpToken {
	/** The token; returned to the owner once and never stored. */
	readonly token: string;
	readonly hash: string;
	readonly last4: string;
	readonly createdAt: Date;
}

/** A new random token: `lmmcp_` + 32 bytes in base64url. */
export function newMcpToken(now = new Date()): IssuedMcpToken {
	return { ...issuePrefixedToken(MCP_TOKEN_PREFIX), createdAt: now };
}

/**
 * Whether `presented` is the token whose hash is stored. Hashes have a
 * fixed length, so the comparison is constant-time whatever was sent.
 */
export function tokenMatches(presented: string, storedHash: string): boolean {
	const stored = Buffer.from(storedHash, "hex");
	const sent = sha256(presented);
	return stored.length === sent.length && timingSafeEqual(stored, sent);
}

export function findMcpToken(
	projectId: Types.ObjectId,
): Promise<StoredMcpToken | null> {
	return McpTokenModel.findOne({ projectId }).lean<StoredMcpToken>();
}

/** Stores `issued` as the project's token (replacing any), `required` as given. */
export async function saveMcpToken(
	projectId: Types.ObjectId,
	issued: IssuedMcpToken,
	required: boolean,
): Promise<StoredMcpToken> {
	const saved = await McpTokenModel.findOneAndUpdate(
		{ projectId },
		{
			$set: {
				required,
				tokenHash: issued.hash,
				tokenLast4: issued.last4,
				tokenCreatedAt: issued.createdAt,
			},
		},
		{ upsert: true, returnDocument: "after" },
	).lean<StoredMcpToken>();
	if (!saved) throw new Error("MCP token upsert returned nothing");
	return saved;
}

/**
 * Stores `issued` as the project's first token, required. `null` when the
 * project has a token already (a concurrent first enable stored it): that
 * token is kept, so the one its caller was shown keeps working.
 */
export async function createFirstMcpToken(
	projectId: Types.ObjectId,
	issued: IssuedMcpToken,
): Promise<StoredMcpToken | null> {
	try {
		return await McpTokenModel.findOneAndUpdate(
			// Matches no document once a token exists: the upsert then hits
			// the unique `projectId` index instead of replacing the token.
			{ projectId, tokenHash: null },
			{
				$set: {
					required: true,
					tokenHash: issued.hash,
					tokenLast4: issued.last4,
					tokenCreatedAt: issued.createdAt,
				},
			},
			{ upsert: true, returnDocument: "after" },
		).lean<StoredMcpToken>();
	} catch (error) {
		if (isDuplicateKeyError(error)) return null;
		throw error;
	}
}

/** Turns the requirement on or off; `null` when the project has no token. */
export function setMcpTokenRequired(
	projectId: Types.ObjectId,
	required: boolean,
): Promise<StoredMcpToken | null> {
	return McpTokenModel.findOneAndUpdate(
		{ projectId, tokenHash: { $ne: null } },
		{ $set: { required } },
		{ returnDocument: "after" },
	).lean<StoredMcpToken>();
}

// Deleting a project removes its token; a clone starts without one.
registerProjectDependent({
	kind: "mcpTokens",
	count: (projectId) => McpTokenModel.countDocuments({ projectId }),
	deleteAll: async (projectId) => {
		await McpTokenModel.deleteMany({ projectId });
	},
});
