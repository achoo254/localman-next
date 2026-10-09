import { createHash } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import mongoose, { Schema } from "mongoose";
import type { RateLimitWindow } from "../config/runtime-settings.js";
import { isDuplicateKeyError } from "../db/mongo-errors.js";

/**
 * Fixed-window hit counters, in Mongo so limits hold across processes and
 * restarts. Keys hold a hash of the client key (IP prefix, account),
 * never the value itself; documents expire with their window.
 */
const rateLimitSchema = new Schema(
	{
		_id: { type: String, required: true },
		hits: { type: Number, required: true, default: 0 },
		expiresAt: { type: Date, required: true },
	},
	{ collection: "rate_limit_windows", versionKey: false },
);
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitWindowModel = mongoose.model(
	"RateLimitWindow",
	rateLimitSchema,
);

/** The 8 hextets of an IPv6 address (an embedded IPv4 tail included). */
function ipv6Hextets(address: string): string[] {
	let text = address;
	const v4Tail = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
	if (v4Tail) {
		const [a, b, c, d] = v4Tail.slice(1).map(Number);
		const hex = (high = 0, low = 0) => ((high << 8) | low).toString(16);
		text = `${text.slice(0, v4Tail.index)}${hex(a, b)}:${hex(c, d)}`;
	}
	const [head = "", tail] = text.split("::");
	const headParts = head === "" ? [] : head.split(":");
	const tailParts = tail === undefined || tail === "" ? [] : tail.split(":");
	const zeros = Array<string>(8 - headParts.length - tailParts.length).fill(
		"0",
	);
	return [...headParts, ...zeros, ...tailParts].map((part) =>
		Number.parseInt(part, 16).toString(16),
	);
}

/**
 * Rate-limit key of a client address. An IPv6 user usually controls a
 * whole /64, so addresses are grouped by it; IPv4-mapped IPv6 counts as
 * the IPv4 address. Unknown addresses share one bucket.
 */
export function clientIpBucket(ip: string | null): string {
	if (!ip) return "unknown";
	const bare = ip.split("%")[0] ?? ip;
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(bare);
	if (mapped?.[1]) return mapped[1];
	if (isIPv4(bare) || !isIPv6(bare)) return bare;
	return `${ipv6Hextets(bare).slice(0, 4).join(":")}::/64`;
}

/**
 * Counts one hit of `key` on `scope` and returns whether it is within the
 * window's limit.
 */
export async function takeRateLimitSlot(
	scope: string,
	key: string,
	window: RateLimitWindow,
	now: Date = new Date(),
): Promise<boolean> {
	const start = Math.floor(now.getTime() / window.windowMs) * window.windowMs;
	const hashed = createHash("sha256")
		.update(key)
		.digest("base64url")
		.slice(0, 22);
	const hit = () =>
		RateLimitWindowModel.findOneAndUpdate(
			{ _id: `${scope}:${hashed}:${start}` },
			{
				$inc: { hits: 1 },
				$setOnInsert: { expiresAt: new Date(start + window.windowMs) },
			},
			{ upsert: true, returnDocument: "after" },
		).lean<{ hits: number }>();
	let counter: { hits: number } | null;
	try {
		counter = await hit();
	} catch (error) {
		// Two first hits of a window racing: the loser increments.
		if (!isDuplicateKeyError(error)) throw error;
		counter = await hit();
	}
	return (counter?.hits ?? 0) <= window.max;
}
