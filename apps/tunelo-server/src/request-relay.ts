import type http from "node:http";
import { DEFAULTS } from "@tunelo/shared";
import type { TokenAuthenticator } from "./auth/token-authenticator.js";
import { tunnelDomains } from "./config/tunnel-domains.js";
import { relayedHeaders } from "./local-forward-gate.js";
import { forwardsLocally, handleLocalForward } from "./local-forward-relay.js";
import { createLogger } from "./logger.js";
import { relayBody } from "./relay-body.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-relay");

/**
 * App subdomain of a Host header on the tenant's tunnel domains, or null
 * for the apex / foreign hosts.
 */
export function extractSubdomain(
	host: string,
	domains: readonly string[] = tunnelDomains(),
): string | null {
	const hostname = host.toLowerCase().replace(/:\d+$/, "");
	// Longest first: with `x.io` and `tunnel.x.io` both configured, the apex
	// `tunnel.x.io` must not read as subdomain `tunnel` of `x.io`.
	const byLength = [...domains].sort((a, b) => b.length - a.length);
	for (const domain of byLength) {
		if (hostname === domain) return null;
		const suffix = `.${domain}`;
		if (!hostname.endsWith(suffix)) continue;
		const label = hostname.slice(0, -suffix.length);
		if (label.length > 0 && !label.includes(".")) return label;
	}
	return null;
}

export interface RelayOptions {
	/** Checks link tokens of local forwards; without it they all get 404. */
	authenticator?: TokenAuthenticator;
}

export function createRelayHandler(
	options: RelayOptions = {},
): http.RequestListener {
	return (req, res) => {
		const host = req.headers.host ?? "";
		const subdomain = extractSubdomain(host);

		// Apex control-plane host (no subdomain): serve tunelo's own /health, else
		// reject. On a tenant subdomain `/health` belongs to the user's app and is
		// relayed like any other path.
		if (!subdomain) {
			if (req.url === DEFAULTS.HEALTH_PATH && req.method === "GET") {
				res.writeHead(200, { "content-type": "application/json" });
				res.end(
					JSON.stringify({ status: "ok", ...tunnelManager.getTenantStats() }),
				);
				return;
			}
			res.writeHead(400, { "content-type": "text/plain" });
			res.end("Bad Request: no tunnel subdomain in Host header");
			return;
		}

		// Gated before the tunnel lookup: a stranger gets the same 404
		// whether the machine is online or not.
		if (forwardsLocally(subdomain, req.url ?? "/")) {
			handleLocalForward(
				req,
				res,
				subdomain,
				options.authenticator,
				(headers) => relayBody(req, res, subdomain, headers, false),
			);
			return;
		}

		if (
			!tunnelManager.has(subdomain) &&
			!tunnelManager.isInGracePeriod(subdomain)
		) {
			res.writeHead(502, { "content-type": "text/plain" });
			res.end(`Tunnel not found: ${subdomain}`);
			return;
		}

		// Basic Auth check — before relaying request to client
		if (
			!tunnelManager.checkAuth(
				subdomain,
				req.headers.authorization as string | undefined,
			)
		) {
			res.writeHead(401, {
				"content-type": "text/plain",
				"www-authenticate": 'Basic realm="tunelo"',
			});
			res.end("Unauthorized");
			return;
		}

		relayBody(
			req,
			res,
			subdomain,
			relayedHeaders(
				subdomain,
				req.headers as Record<string, string | string[]>,
			),
			true,
		);
	};
}
