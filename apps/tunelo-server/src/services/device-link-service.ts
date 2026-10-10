import { randomBytes, randomInt } from "node:crypto";
import { TUNNEL_SCOPES } from "@tunelo/shared";
import { isValidObjectId } from "mongoose";
import { TuneloError } from "../api/middleware/error-handler.js";
import { hashToken } from "../auth/token-hash.js";
import { ApiKey } from "../db/models/api-key-model.js";
import { LinkRequest } from "../db/models/link-request-model.js";
import { AttemptLimiter } from "../lib/attempt-limiter.js";
import { issueLinkToken } from "./access-token-service.js";

export const LINK_TTL_MS = 10 * 60 * 1000;
export const MAX_WRONG_CODES = 5;
/** No 0/O, 1/I: the code is read off a screen and typed. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const DUPLICATE_KEY = 11000;

/** Wrong codes per approving token, locked for the rest of the window. */
const wrongCodes = new AttemptLimiter(MAX_WRONG_CODES, LINK_TTL_MS);

function generateCode(): string {
	let code = "";
	for (let i = 0; i < CODE_LENGTH; i++) {
		code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
	}
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** "abcd efgh" / "ABCD-EFGH" → "ABCDEFGH"; null when it cannot be a code. */
export function normalizeLinkCode(input: string): string | null {
	const code = input.toUpperCase().replace(/[\s-]/g, "");
	if (code.length !== CODE_LENGTH) return null;
	for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
	return code;
}

function codeHashOf(normalized: string): string {
	return hashToken(`link:${normalized}`);
}

function isDuplicateKey(err: unknown): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"code" in err &&
		err.code === DUPLICATE_KEY
	);
}

const WRONG_CODE = new TuneloError(
	"TUNELO_LINK_001",
	"Invalid or expired link code",
	400,
);

/** A client opens a pairing and shows the user the code. */
export async function initLink(
	clientName: string,
): Promise<{ requestId: string; code: string; expiresAt: string }> {
	const expiresAt = new Date(Date.now() + LINK_TTL_MS);
	// A code collision with a live request is astronomically rare; retry once
	// or twice rather than fail.
	for (let attempt = 0; attempt < 3; attempt++) {
		const code = generateCode();
		const requestId = randomBytes(24).toString("hex");
		try {
			await LinkRequest.create({
				requestId,
				codeHash: codeHashOf(code.replace("-", "")),
				clientName,
				expiresAt,
			});
			return { requestId, code, expiresAt: expiresAt.toISOString() };
		} catch (err) {
			if (!isDuplicateKey(err)) throw err;
		}
	}
	throw new TuneloError("TUNELO_SERVER_001", "Could not open a link", 500);
}

/**
 * The anonymous machine approves with the code. `approverKeyId` (its token's
 * id) is what gets locked after too many wrong codes.
 */
export async function approveLink(
	code: string,
	approver: { keyId: string; deviceId: string },
): Promise<{ clientName: string }> {
	if (wrongCodes.isBlocked(approver.keyId)) {
		throw new TuneloError(
			"TUNELO_LINK_002",
			"Too many wrong link codes, try again in 10 minutes",
			429,
		);
	}
	const normalized = normalizeLinkCode(code);
	const request = normalized
		? await LinkRequest.findOneAndUpdate(
				{
					codeHash: codeHashOf(normalized),
					status: "pending",
					expiresAt: { $gt: new Date() },
				},
				{ status: "approved", linkedDeviceId: approver.deviceId },
				{ returnDocument: "after" },
			)
		: null;
	if (!request) {
		wrongCodes.hit(approver.keyId);
		throw WRONG_CODE;
	}
	return { clientName: request.clientName ?? "" };
}

/**
 * The client polls. The link token is minted only by the poll that claims
 * (deletes) the approved row, so no plaintext token is ever stored and an
 * approval nobody collects in time leaves no token behind.
 */
export async function pollLink(
	requestId: string,
): Promise<
	| { status: "pending" }
	| { status: "expired" }
	| { status: "approved"; token: string; linkId: string }
> {
	const request = await LinkRequest.findOne({ requestId });
	if (!request || request.expiresAt < new Date()) return { status: "expired" };
	if (request.status !== "approved") return { status: "pending" };

	const claimed = await LinkRequest.findOneAndDelete({
		_id: request._id,
		status: "approved",
		expiresAt: { $gt: new Date() },
	});
	if (!claimed?.linkedDeviceId) return { status: "expired" };
	const link = await issueLinkToken({
		linkedDeviceId: claimed.linkedDeviceId,
		clientName: claimed.clientName ?? "",
	});
	return { status: "approved", token: link.token, linkId: link.id };
}

const LINK_TOKEN_FILTER = {
	status: "active" as const,
	scopes: TUNNEL_SCOPES.READ,
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

/** A link token revokes itself (the client unlinks). */
export async function revokeOwnLink(keyId: string): Promise<void> {
	await ApiKey.updateOne(
		{ _id: keyId, ...LINK_TOKEN_FILTER },
		{ $set: { status: "revoked" } },
	);
}
