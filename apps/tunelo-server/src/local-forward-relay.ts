import { AsyncResource } from "node:async_hooks";
import type http from "node:http";
import { isLocalForwardPath } from "@tunelo/shared";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import {
	type ForwardDecision,
	gateLocalForward,
	writeForwardRefusal,
} from "./local-forward-gate.js";
import { createLogger } from "./logger.js";
import { isMachineSubdomain } from "./machine-subdomain.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-local-forward");

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
	const done = AsyncResource.bind((decision: ForwardDecision) => {
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
