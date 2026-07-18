import { randomBytes } from "node:crypto";
import { TuneloError } from "../api/middleware/error-handler.js";
import { DeviceSession } from "../db/models/device-session-model.js";
import { issueAccessToken } from "./access-token-service.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const SESSION_TTL_MS = 5 * 60 * 1000;

function generateCode(): string {
	const bytes = randomBytes(8);
	let code = "";
	for (let i = 0; i < 8; i++) code += CODE_CHARS[bytes[i] % CODE_CHARS.length];
	return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Creates a pending pairing session; returns the code shown in the browser. */
export async function createSession(): Promise<{ code: string }> {
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
	for (let attempt = 0; attempt < 3; attempt++) {
		const code = generateCode();
		try {
			await DeviceSession.create({ code, status: "pending", expiresAt });
			return { code };
		} catch (err: unknown) {
			if ((err as { code?: number }).code !== 11000 || attempt === 2) throw err;
		}
	}
	throw new TuneloError("TUNELO_DEVICE_001", "Could not create session", 500);
}

/** Browser polls this; only exposes status, never the token. */
export async function getStatus(
	code: string,
): Promise<"pending" | "claimed" | "expired"> {
	const session = await DeviceSession.findOne({ code });
	if (!session) return "expired";
	if (session.expiresAt < new Date()) return "expired";
	return session.status === "claimed" ? "claimed" : "pending";
}

/** CLI submits the code; issues a token and flips the session to claimed. */
export async function claim(code: string): Promise<{ token: string }> {
	const session = await DeviceSession.findOneAndUpdate(
		{ code, status: "pending", expiresAt: { $gt: new Date() } },
		{ status: "claimed" },
		{ new: true },
	);
	if (!session) {
		throw new TuneloError("TUNELO_DEVICE_002", "Invalid or expired code", 400);
	}
	const { token } = await issueAccessToken(
		`device-${new Date().toISOString().slice(0, 10)}`,
	);
	return { token };
}
