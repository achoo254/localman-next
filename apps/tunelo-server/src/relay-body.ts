import { AsyncResource } from "node:async_hooks";
import type http from "node:http";
import {
	DEFAULTS,
	type TunnelRequest,
	generateRequestId,
} from "@tunelo/shared";
import { tryServeFromCache, wrapForCache } from "./cache/caching-sink.js";
import { createLogger } from "./logger.js";
import { usageTracker } from "./services/usage-tracker.js";
import { createResponseSink } from "./stream/response-sink.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-relay");

/**
 * Reads the body (size-limited) and streams the request to the tunnel.
 * `cacheable`: the Redis response cache may answer or keep it.
 */
export function relayBody(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	subdomain: string,
	headers: Record<string, string | string[]>,
	cacheable: boolean,
): void {
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
			const cachedBytes = cacheable
				? await tryServeFromCache(
						res,
						subdomain,
						path,
						method,
						hasAuth,
						acceptEncoding,
					)
				: null;
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
				headers,
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
						usageTracker.record(tunnel.keyId, tunnel.userId, bytesIn, bytesOut);
					}
				},
			);
			tunnelManager.openStream(
				subdomain,
				tunnelReq,
				cacheable
					? wrapForCache(sink, subdomain, path, method, hasAuth, acceptEncoding)
					: sink,
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
}
