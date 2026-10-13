import { OperationError } from "@localman/operations";
import type { Response } from "express";
import { runtimeSettings } from "../../config/runtime-settings.js";
import { takeRateLimitSlot } from "../../lib/rate-limit-windows.js";
import { tenantKey } from "../../tenancy/tenant-context.js";
import { TtlLruCache } from "../mock-runtime/ttl-lru-cache.js";
import { ensureUserForSubject } from "../users/user-sync.js";
import {
	JSON_RPC_INTERNAL_ERROR,
	type JsonRpcCall,
	sendJsonRpcError,
} from "./mcp-json-rpc.js";

/** Open `subscriptions/listen` streams one IdP subject may hold at once. */
export const MAX_SUBSCRIPTIONS_PER_SUBJECT = 5;

/**
 * Counts one Localman MCP request of `subject` in the shared Mongo window
 * (`localmanMcpRateLimit`), so the limit holds across processes. Past it,
 * sets `Retry-After` (seconds to the end of the window) and throws 429
 * `RATE_LIMITED`.
 */
export async function takeMcpRequestSlot(
	subject: string,
	res: Response,
	now: Date = new Date(),
): Promise<void> {
	const window = runtimeSettings().localmanMcpRateLimit;
	if (await takeRateLimitSlot("localman-mcp", subject, window, now)) return;
	const left = window.windowMs - (now.getTime() % window.windowMs);
	res.set("Retry-After", String(Math.max(1, Math.ceil(left / 1000))));
	throw new OperationError(
		429,
		"RATE_LIMITED",
		"Too many MCP requests, slow down",
	);
}

/**
 * Open subscription streams per subject. A stream lives as long as its
 * HTTP response, so a slot is taken before the request is served and
 * given back when the response closes, whatever ended it.
 */
export class SubscriptionSlots {
	readonly #open = new Map<string, number>();

	constructor(private readonly max = MAX_SUBSCRIPTIONS_PER_SUBJECT) {}

	/** A release function, or `null` when `subject` holds `max` already. */
	take(subject: string): (() => void) | null {
		const open = this.#open.get(subject) ?? 0;
		if (open >= this.max) return null;
		this.#open.set(subject, open + 1);
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const left = (this.#open.get(subject) ?? 1) - 1;
			if (left > 0) this.#open.set(subject, left);
			else this.#open.delete(subject);
		};
	}

	/**
	 * For a `subscriptions/listen` request, holds a slot of `subject` until
	 * `res` closes. At the limit it answers in-band, as the SDK does at its
	 * own limit, and returns false; other requests pass untouched.
	 */
	holdFor(subject: string, call: JsonRpcCall | null, res: Response): boolean {
		if (call?.method !== "subscriptions/listen") return true;
		const release = this.take(subject);
		if (release) {
			res.once("close", release);
			return true;
		}
		sendJsonRpcError(
			res,
			200,
			{
				code: JSON_RPC_INTERNAL_ERROR,
				message: `Subscription limit reached: at most ${this.max} open subscriptions per user`,
			},
			call.id,
		);
		return false;
	}
}

/**
 * Subjects whose user row is known to exist. Rows are never deleted, so
 * a hit skips the upsert; entries expire after 10 minutes, at most
 * 10 000 are kept.
 */
const knownSubjects = new TtlLruCache<true>(10_000, 10 * 60_000);

/** `ensureUserForSubject`, at most once per tenant, subject and TTL. */
export async function ensureKnownSubject(subject: string): Promise<void> {
	const key = tenantKey(subject);
	if (knownSubjects.get(key)) return;
	await ensureUserForSubject(subject);
	knownSubjects.set(key, true);
}

/** TEST ONLY. Forgets the known subjects (tests empty the users collection). */
export function clearKnownSubjects(): void {
	knownSubjects.clear();
}
