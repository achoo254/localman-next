import type http from "node:http";
import {
	DEFAULTS,
	TUNNEL_DOMAIN,
	type TunnelRequest,
	generateRequestId,
} from "@tunelo/shared";
import { tryServeFromCache, wrapForCache } from "./cache/caching-sink.js";
import { createLogger } from "./logger.js";
import { usageTracker } from "./services/usage-tracker.js";
import { createResponseSink } from "./stream/response-sink.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-relay");

export function extractSubdomain(host: string): string | null {
	const domainEscaped = TUNNEL_DOMAIN.replace(/\./g, "\\.");
	const regex = new RegExp(`^([^.]+)\\.${domainEscaped}`);
	const match = host.match(regex);
	return match ? match[1] : null;
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
				res.end(JSON.stringify({ status: "ok", ...tunnelManager.getStats() }));
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

		req.on("end", async () => {
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
			res.on("close", () =>
				tunnelManager.cancelStream(subdomain, tunnelReq.id),
			);

			const sink = createResponseSink(
				res,
				subdomain,
				tunnelReq.id,
				(bytesOut) => {
					if (tunnel) {
						usageTracker.record(tunnel.keyId, tunnel.userId, bytesIn, bytesOut);
					}
				},
			);
			tunnelManager.openStream(
				subdomain,
				tunnelReq,
				wrapForCache(sink, subdomain, path, method, hasAuth, acceptEncoding),
			);
		});

		req.on("error", (err) => {
			logger.error({ err }, "Request read error");
			if (!res.writableEnded) {
				res.writeHead(500, { "content-type": "text/plain" });
				res.end("Internal Server Error");
			}
		});
	};
}
