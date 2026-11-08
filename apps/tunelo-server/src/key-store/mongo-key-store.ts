import { connectDb, disconnectDb } from "../db/connection-manager.js";
import { ApiKey } from "../db/models/api-key-model.js";
import { createLogger } from "../logger.js";
import type { KeyInfo, KeyStore } from "./key-store-types.js";

const logger = createLogger("tunelo-mongo-key-store");

const DEVICE_LABEL_PREFIX = "device:";

/** Device login labels its tokens `device:<name>`. */
function deviceNameOf(label: string | null | undefined): string | undefined {
	if (!label?.startsWith(DEVICE_LABEL_PREFIX)) return undefined;
	return label.slice(DEVICE_LABEL_PREFIX.length) || undefined;
}

const RECORD_USE_EVERY_MS = 60_000;
const MAX_TRACKED_KEYS = 10_000;
const lastRecorded = new Map<string, number>();

/** Whether `lastUsedAt` of the key is due a write (once a minute). */
export function shouldRecordUse(keyId: string, now = Date.now()): boolean {
	const last = lastRecorded.get(keyId);
	if (last !== undefined && now - last < RECORD_USE_EVERY_MS) return false;
	if (lastRecorded.size >= MAX_TRACKED_KEYS) {
		for (const [id, at] of lastRecorded) {
			if (now - at >= RECORD_USE_EVERY_MS) lastRecorded.delete(id);
		}
		if (lastRecorded.size >= MAX_TRACKED_KEYS) lastRecorded.clear();
	}
	lastRecorded.set(keyId, now);
	return true;
}

export class MongoKeyStore implements KeyStore {
	constructor(private readonly uri: string) {}

	async validate(keyHash: string): Promise<KeyInfo | null> {
		const apiKey = await ApiKey.findOne({
			keyHash,
			status: "active",
		}).lean();

		if (!apiKey) return null;

		// Check expiry
		if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
			return null;
		}

		// Fire-and-forget lastUsedAt update, at most once a minute per key:
		// link tokens are checked on every forwarded request.
		if (shouldRecordUse(String(apiKey._id))) {
			ApiKey.updateOne(
				{ _id: apiKey._id },
				{ $set: { lastUsedAt: new Date() } },
			).catch((err) => {
				logger.warn({ err }, "Failed to update lastUsedAt");
			});
		}

		// No user accounts: the key stands alone. Its _id is the identity used
		// for tunnel ownership/usage; limits come from the key itself.
		const keyId = String(apiKey._id);
		const scopes = apiKey.scopes ?? [];
		return {
			kind: scopes.length > 0 ? "link" : "legacy",
			userId: keyId,
			keyId,
			keyHash,
			maxTunnels: apiKey.maxTunnels ?? 3,
			role: "user",
			scopes,
			deviceId: apiKey.deviceId ?? undefined,
			deviceName: deviceNameOf(apiKey.label),
			linkedDeviceId: apiKey.linkedDeviceId ?? undefined,
			linkedOwnerSub: apiKey.linkedOwnerSub ?? undefined,
		};
	}

	async recordUsage(_keyHash: string): Promise<void> {
		// Placeholder — implemented in Phase 3 (UsageTracker)
	}

	async initialize(): Promise<void> {
		await connectDb(this.uri);
		logger.info("MongoKeyStore initialized");
	}

	async shutdown(): Promise<void> {
		await disconnectDb();
		logger.info("MongoKeyStore shut down");
	}
}
