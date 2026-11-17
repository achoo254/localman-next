import type http from "node:http";
import { DEFAULTS, stripTuneloHeaders } from "@tunelo/shared";
import { tunnelDomains } from "./config/tunnel-domains.js";
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

export function createRelayHandler(): http.RequestListener {
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

		// `tunelo-*` headers are reserved for Tunelo: none sent by a client
		// reaches a tunnel.
		relayBody(
			req,
			res,
			subdomain,
			stripTuneloHeaders(req.headers as Record<string, string | string[]>),
			true,
		);
	};
}
