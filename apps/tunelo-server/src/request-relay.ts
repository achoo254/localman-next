import { AsyncResource } from "node:async_hooks";
import type http from "node:http";
import {
	DEFAULTS,
	type TunnelRequest,
	generateRequestId,
} from "@tunelo/shared";
import { tryServeFromCache, wrapForCache } from "./cache/caching-sink.js";
import { tunnelDomains } from "./config/tunnel-domains.js";
import { createLogger } from "./logger.js";
import { usageTracker } from "./services/usage-tracker.js";
import { createResponseSink } from "./stream/response-sink.js";
import { PRIMARY_TENANT_ID } from "./tenancy/primary-tenant.js";
import { currentTenant } from "./tenancy/tunnel-tenant.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-relay");

/** Tunnel domains of the tenant in scope: the primary's `TUNNEL_DOMAINS`. */
export function tenantTunnelDomains(): readonly string[] {
	const tenant = currentTenant();
	return tenant.id === PRIMARY_TENANT_ID
		? tunnelDomains()
		: [tenant.tunnelDomain];
}

/**
 * App subdomain of a Host header on the tenant's tunnel domains, or null
 * for the apex / foreign hosts.
 */
export function extractSubdomain(
	host: string,
	domains: readonly string[] = tenantTunnelDomains(),
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

		// Collect request body with size limit
		const chunks: Buffer[] = [];
		let bodySize = 0;

		req.on("data", (chunk: Buffer) => {
			bodySize += chunk.length;
			if (bodySize > DEFAULTS.MAX_BODY_SIZE) {
				res.writeHead(413, { "content-type": "text/plain" });
				res.end("Request body too large");
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});

		// Bound to this request's async context: the tunnel lookups below run
		// in its tenant whatever context the stream emits in.
		req.on(
			"end",
			AsyncResource.bind(async () => {
				if (res.writableEnded) return;

				const path = req.url ?? "/";
				const method = req.method ?? "GET";
				const hasAuth = Boolean(req.headers.authorization);
				const acceptEncoding = String(req.headers["accept-encoding"] ?? "");
				const body =
					chunks.length > 0 ? Buffer.concat(chunks).toString("base64") : null;

				// Attribute usage to the tunnel that owns the request at dispatch time.
				const tunnel = tunnelManager.get(subdomain);
				const bytesIn = body ? Buffer.byteLength(body, "base64") : 0;

				// Best-effort: serve a cacheable GET from Redis without a WS round-trip.
				const cachedBytes = await tryServeFromCache(
					res,
					subdomain,
					path,
					method,
					hasAuth,
					acceptEncoding,
				);
				if (cachedBytes !== null) {
					if (tunnel)
						usageTracker.record(
							tunnel.keyId,
							tunnel.userId,
							bytesIn,
							cachedBytes,
						);
					return;
				}

				const tunnelReq: TunnelRequest = {
					type: "request",
					id: generateRequestId(),
					method,
					path,
					headers: req.headers as Record<string, string | string[]>,
					body,
					subdomain,
				};

				// If the downstream consumer disconnects, tell the client to stop
				// producing (no-op once the stream has already finished).
				res.on(
					"close",
					AsyncResource.bind(() =>
						tunnelManager.cancelStream(subdomain, tunnelReq.id),
					),
				);

				const sink = createResponseSink(
					res,
					subdomain,
					tunnelReq.id,
					(bytesOut) => {
						if (tunnel) {
							usageTracker.record(
								tunnel.keyId,
								tunnel.userId,
								bytesIn,
								bytesOut,
							);
						}
					},
				);
				tunnelManager.openStream(
					subdomain,
					tunnelReq,
					wrapForCache(sink, subdomain, path, method, hasAuth, acceptEncoding),
				);
			}),
		);

		req.on("error", (err) => {
			logger.error({ err }, "Request read error");
			if (!res.writableEnded) {
				res.writeHead(500, { "content-type": "text/plain" });
				res.end("Internal Server Error");
			}
		});
	};
}
