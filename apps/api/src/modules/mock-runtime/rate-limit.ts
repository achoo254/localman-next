import { OperationError } from "@localman/operations";
import type { Request, RequestHandler, Response } from "express";
import { clientIpBucket } from "../../lib/rate-limit-windows.js";
import { type MockAddress, looksLikeMcp } from "./resolve-project.js";

export type RateDecision =
	| { readonly ok: true }
	| { readonly ok: false; readonly retryAfterSeconds: number };

/**
 * Fixed-window counters kept in this process's memory. The mock runtime
 * runs as one process (PM2 fork mode); with several, each would allow
 * the full rate, which is acceptable at this stage (Mongo windows like
 * the feedback form would cost a write per mock request). A window
 * counts hits (`take`) or any amount such as bytes (`add`). Windows of
 * other keys are swept once per window, so memory follows the number of
 * clients active in the last window.
 */
export class WindowRateLimiter {
	private readonly windows = new Map<string, { start: number; used: number }>();
	private sweptAt = 0;

	constructor(
		private readonly max: number,
		private readonly windowMs = 1000,
		private readonly now: () => number = Date.now,
	) {}

	private windowOf(key: string): { start: number; used: number } {
		const now = this.now();
		const start = now - (now % this.windowMs);
		if (start > this.sweptAt) {
			this.sweptAt = start;
			for (const [other, window] of this.windows) {
				if (window.start < start) this.windows.delete(other);
			}
		}
		let window = this.windows.get(key);
		if (!window || window.start !== start) {
			window = { start, used: 0 };
			this.windows.set(key, window);
		}
		return window;
	}

	private refuse(start: number): RateDecision {
		const wait = (start + this.windowMs - this.now()) / 1000;
		return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil(wait)) };
	}

	/** Counts one hit; refused once the window holds more than `max`. */
	take(key: string): RateDecision {
		const window = this.windowOf(key);
		window.used += 1;
		return window.used <= this.max ? { ok: true } : this.refuse(window.start);
	}

	/** Refused while the window's amount has reached `max` (see `add`). */
	check(key: string): RateDecision {
		const window = this.windowOf(key);
		return window.used < this.max ? { ok: true } : this.refuse(window.start);
	}

	/** Adds an amount (bytes sent) to the current window. */
	add(key: string, amount: number): void {
		this.windowOf(key).used += amount;
	}

	get size(): number {
		return this.windows.size;
	}
}

export interface MockRateLimits {
	/** Requests per second per project secret. */
	readonly perSecret: number;
	/** Requests per second per client IP (IPv6 grouped by /64). */
	readonly perIp: number;
	/** POST, PUT, PATCH and DELETE per second per project secret. */
	readonly writesPerSecret: number;
	/** Response bytes per second per project secret. */
	readonly responseBytesPerSecret: number;
}

const WRITE_METHODS: ReadonlySet<string> = new Set([
	"POST",
	"PUT",
	"PATCH",
	"DELETE",
]);

/**
 * The limits of one mock app. Requests are admitted by IP, by secret, by
 * secret for writes (each write takes the project lock), and while the
 * secret's response bytes of the current second stay under budget; the
 * router charges the bytes it sends, or the bytes a list scanned when
 * that is more (`chargeResponse`). A response that
 * starts under budget is sent whole, so a second may exceed it by one
 * response (at most `MAX_RESPONSE_BYTES`).
 */
export class MockLimiters {
	private readonly byIp: WindowRateLimiter;
	private readonly bySecret: WindowRateLimiter;
	private readonly writes: WindowRateLimiter;
	private readonly bytes: WindowRateLimiter;

	constructor(limits: MockRateLimits, now: () => number = Date.now) {
		this.byIp = new WindowRateLimiter(limits.perIp, 1000, now);
		this.bySecret = new WindowRateLimiter(limits.perSecret, 1000, now);
		this.writes = new WindowRateLimiter(limits.writesPerSecret, 1000, now);
		this.bytes = new WindowRateLimiter(
			limits.responseBytesPerSecret,
			1000,
			now,
		);
	}

	admit(ip: string | null, secret: string, method: string): RateDecision {
		const byIp = this.byIp.take(clientIpBucket(ip));
		if (!byIp.ok) return byIp;
		const bySecret = this.bySecret.take(secret);
		if (!bySecret.ok) return bySecret;
		if (WRITE_METHODS.has(method)) {
			const writes = this.writes.take(secret);
			if (!writes.ok) return writes;
		}
		return this.bytes.check(secret);
	}

	/**
	 * Takes a write of `secret` for a REST write admitted as a read because
	 * its path looked like the MCP endpoint (see `rateMethodOf`).
	 */
	admitWrite(secret: string): RateDecision {
		return this.writes.take(secret);
	}

	chargeResponse(secret: string, bytes: number): void {
		this.bytes.add(secret, bytes);
	}
}

/**
 * The method a request is admitted as. A path that may be the MCP
 * endpoint (`looksLikeMcp`) is admitted as a read (every MCP exchange is
 * a POST); `callMockTool` admits each tool call again with its own method.
 */
export function rateMethodOf(method: string, address: MockAddress): string {
	return looksLikeMcp(address) ? "GET" : method;
}

/** Whether a REST request still owes the write `rateMethodOf` skipped. */
export function owesWrite(method: string, address: MockAddress): boolean {
	return looksLikeMcp(address) && WRITE_METHODS.has(method);
}

/** `details.retryAfterSeconds` stands in for `Retry-After` in MCP results. */
export function rateLimited(retryAfterSeconds?: number): OperationError {
	return new OperationError(
		429,
		"RATE_LIMITED",
		"Too many requests, slow down",
		retryAfterSeconds === undefined ? undefined : { retryAfterSeconds },
	);
}

export function tooManyRequests(
	res: Response,
	retryAfterSeconds: number,
): void {
	res.setHeader("Retry-After", String(retryAfterSeconds));
	res.status(429).json(rateLimited().toBody());
}

/**
 * 429 `RATE_LIMITED` with `Retry-After` for mock requests over a limit;
 * the client IP comes from Express `trust proxy` (TRUST_PROXY). Runs
 * before the body is parsed. Requests that address no project
 * (`/healthz`) are not counted.
 */
export function mockRateLimit(
	limiters: MockLimiters,
	addressOf: (req: Request) => MockAddress | undefined,
): RequestHandler {
	return (req, res, next) => {
		const address = addressOf(req);
		if (!address) {
			next();
			return;
		}
		const decision = limiters.admit(
			req.ip ?? null,
			address.secret,
			rateMethodOf(req.method, address),
		);
		if (decision.ok) next();
		else tooManyRequests(res, decision.retryAfterSeconds);
	};
}
