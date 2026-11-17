import { AsyncResource } from "node:async_hooks";
import type http from "node:http";
import { LOCAL_FORWARD_ERRORS, isLocalForwardPath } from "@tunelo/shared";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { AttemptLimiter } from "./lib/attempt-limiter.js";
import {
	type ForwardDecision,
	gateLocalForward,
	writeForwardRefusal,
} from "./local-forward-gate.js";
import { createLogger } from "./logger.js";
import { isMachineSubdomain } from "./machine-subdomain.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-local-forward");

/** Requests one machine takes per minute through its forward path. */
export const FORWARDS_PER_MACHINE_MINUTE = 1200;
/** Refused forwards (no owner's token) one caller may send per 10 minutes. */
export const REFUSED_FORWARDS_PER_CALLER = 100;
const perMachine = new AttemptLimiter(FORWARDS_PER_MACHINE_MINUTE, 60_000);
const refusedByCaller = new AttemptLimiter(
	REFUSED_FORWARDS_PER_CALLER,
	10 * 60_000,
);

const RATE_LIMITED: ForwardDecision = {
	ok: false,
	status: 429,
	code: LOCAL_FORWARD_ERRORS.RATE_LIMITED,
	port: null,
};

/** The caller's address: Express's `req.ip` (behind nginx), else the socket's. */
function callerOf(req: http.IncomingMessage): string {
	const ip: unknown = Reflect.get(req, "ip");
	return typeof ip === "string" ? ip : (req.socket.remoteAddress ?? "unknown");
}

/**
 * Counts a decided forward against the limits: refusals per caller (token
 * guessing), granted requests per machine (one machine's loopback cannot
 * be flooded through the relay). Once either is used up, further
 * requests get 429 before any token is checked.
 */
function limited(
	decision: ForwardDecision,
	caller: string,
	subdomain: string,
): ForwardDecision {
	if (decision.ok) {
		perMachine.hit(subdomain);
		return decision;
	}
	if (decision.code === LOCAL_FORWARD_ERRORS.NOT_FOUND) {
		refusedByCaller.hit(caller);
	}
	return decision;
}

/** A request for the machine's loopback (`LOCAL_FORWARD.PATH`). */
export function forwardsLocally(subdomain: string, url: string): boolean {
	return isMachineSubdomain(subdomain) && isLocalForwardPath(url);
}

/** Path without the query: queries may carry secrets. */
function pathOnly(url: string): string {
	const at = url.indexOf("?");
	return (at === -1 ? url : url.slice(0, at)).slice(0, 300);
}

/**
 * Gates a local forward, logs it (time, machine, port, method, path; never
 * headers or body) and relays it with the granted headers, or answers the
 * refusal. The relay is never cached.
 */
export function handleLocalForward(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	subdomain: string,
	authenticator: TokenAuthenticator | undefined,
	relay: (headers: Record<string, string | string[]>) => void,
): void {
	const url = req.url ?? "/";
	// A machine reconnecting counts as offline: the caller retries, rather
	// than wait out the grace period for a plain 502.
	const online = tunnelManager.has(subdomain);
	const caller = callerOf(req);
	const done = AsyncResource.bind((decided: ForwardDecision) => {
		const decision = limited(decided, caller, subdomain);
		logger.info(
			{
				subdomain,
				port: decision.port,
				method: req.method,
				path: pathOnly(url),
				outcome: decision.ok ? "granted" : decision.code,
			},
			"Local forward",
		);
		if (decision.ok) relay(decision.headers);
		else writeForwardRefusal(res, decision);
	});
	if (refusedByCaller.isBlocked(caller) || perMachine.isBlocked(subdomain)) {
		done(RATE_LIMITED);
		return;
	}
	gateLocalForward({
		authenticator,
		subdomain,
		headers: req.headers as Record<string, string | string[]>,
		online,
	})
		.then(done)
		.catch((err: unknown) => {
			logger.error({ err, subdomain }, "Local forward check failed");
			if (!res.headersSent) {
				res.writeHead(500, { "content-type": "text/plain" });
				res.end("Internal Server Error");
			}
		});
}
