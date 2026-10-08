import { randomBytes } from "node:crypto";
import { TuneloError } from "../api/middleware/error-handler.js";
import { LoginRequest } from "../db/models/login-request-model.js";
import { issueAccessToken } from "./access-token-service.js";

const REQUEST_TTL_MS = 5 * 60 * 1000;

function generateRequestId(): string {
	return randomBytes(18).toString("hex");
}

/** CLI starts a login: registers its device and gets a request id. */
export async function initRequest(
	deviceId: string,
	deviceName: string,
): Promise<{ requestId: string }> {
	const requestId = generateRequestId();
	await LoginRequest.create({
		requestId,
		deviceId,
		deviceName,
		status: "pending",
		expiresAt: new Date(Date.now() + REQUEST_TTL_MS),
	});
	return { requestId };
}

/** Browser reads the device it is about to approve (never the token). */
export async function getRequest(
	requestId: string,
): Promise<{ deviceName: string; deviceId: string; status: string } | null> {
	const req = await LoginRequest.findOne({ requestId });
	if (!req || req.expiresAt < new Date()) return null;
	return {
		deviceName: req.deviceName ?? "",
		deviceId: req.deviceId,
		status: req.status ?? "pending",
	};
}

/** Browser approves: mint (or rotate) the device's token and attach it. */
export async function approve(requestId: string): Promise<void> {
	const req = await LoginRequest.findOneAndUpdate(
		{ requestId, status: "pending", expiresAt: { $gt: new Date() } },
		{ status: "approved" },
		{ new: true },
	);
	if (!req) {
		throw new TuneloError(
			"TUNELO_DEVICE_002",
			"Invalid or expired login request",
			400,
		);
	}
	const { token } = await issueAccessToken(
		`device:${req.deviceName || req.deviceId}`,
		{
			deviceId: req.deviceId,
		},
	);
	await LoginRequest.updateOne({ _id: req._id }, { issuedToken: token });
}

/** CLI polls; once approved it returns the token exactly once. */
export async function poll(
	requestId: string,
): Promise<
	| { status: "pending" }
	| { status: "approved"; token: string }
	| { status: "expired" }
> {
	const req = await LoginRequest.findOne({ requestId });
	if (!req || req.expiresAt < new Date()) return { status: "expired" };
	if (req.status !== "approved" || !req.issuedToken) {
		return { status: "pending" };
	}
	const token = req.issuedToken;
	// Deliver once, then drop the plaintext.
	await LoginRequest.deleteOne({ _id: req._id });
	return { status: "approved", token };
}
