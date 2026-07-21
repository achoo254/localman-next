import type http from "node:http";
import {
	DEFAULTS,
	ErrorCode,
	TUNNEL_DOMAIN,
	type TunnelRequest,
	generateRequestId,
	needsUnbufferedRelay,
	stripHopByHopHeaders,
} from "@tunelo/shared";
import { createLogger } from "./logger.js";
import { usageTracker } from "./services/usage-tracker.js";
import type { StreamSink } from "./stream/stream-registry.js";
import { tunnelManager } from "./tunnel-manager.js";

const logger = createLogger("tunelo-relay");

export function extractSubdomain(host: string): string | null {
	const domainEscaped = TUNNEL_DOMAIN.replace(/\./g, "\\.");
	const regex = new RegExp(`^([^.]+)\\.${domainEscaped}`);
	const match = host.match(regex);
	return match ? match[1] : null;
}

/**
 * Build a sink that streams a relayed response straight into the HTTP response:
 * write headers on start, each chunk as it arrives, end on completion. This is
 * what makes SSE / chunked responses work — nothing is buffered whole.
 * `onComplete` fires exactly once with the bytes written, for usage tracking.
 */
function createResponseSink(
	res: http.ServerResponse,
	subdomain: string,
	requestId: string,
	onComplete: (bytesOut: number) => void,
): StreamSink {
	let bytesOut = 0;
	let completed = false;
	const complete = (): void => {
		if (completed) return;
		completed = true;
		onComplete(bytesOut);
	};
	return {
		onStart(status, headers) {
			if (res.headersSent || res.writableEnded || res.destroyed) return;
			try {
				const outHeaders = stripHopByHopHeaders(headers);
				// SSE / unknown-length streams must not be buffered or cached by a
				// fronting nginx — signal it to relay them straight through.
				if (needsUnbufferedRelay(headers))
					outHeaders["x-accel-buffering"] = "no";
				res.writeHead(status, outHeaders as http.OutgoingHttpHeaders);
				res.flushHeaders();
			} catch (err) {
				// Malformed header name/value from the local service — don't crash.
				logger.warn({ err, subdomain, requestId }, "Invalid response headers");
				if (!res.headersSent) {
					res.writeHead(502, { "content-type": "text/plain" });
					res.end("Bad Gateway");
				}
			}
		},
		onData(chunk) {
			if (res.writableEnded || res.destroyed) return;
			bytesOut += chunk.length;
			res.write(chunk);
		},
		onEnd() {
			if (!res.writableEnded) res.end();
			complete();
		},
		onError(err) {
			// Headers already sent — can only cut the connection.
			if (res.headersSent) {
				if (!res.writableEnded) res.end();
				complete();
				return;
			}
			logger.error({ err, subdomain, requestId }, "Relay error");
			const isTimeout = err.message.includes(ErrorCode.REQUEST_TIMEOUT);
			res.writeHead(isTimeout ? 504 : 502, { "content-type": "text/plain" });
			res.end(isTimeout ? "Gateway Timeout" : "Bad Gateway");
			complete();
		},
	};
}

export function createRelayHandler(): http.RequestListener {
	return (req, res) => {
		// Health check — handled before relay
		if (req.url === DEFAULTS.HEALTH_PATH && req.method === "GET") {
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ status: "ok", ...tunnelManager.getStats() }));
			return;
		}

		const host = req.headers.host ?? "";
		const subdomain = extractSubdomain(host);

		if (!subdomain) {
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

		req.on("end", () => {
			if (res.writableEnded) return;

			const body =
				chunks.length > 0 ? Buffer.concat(chunks).toString("base64") : null;

			const tunnelReq: TunnelRequest = {
				type: "request",
				id: generateRequestId(),
				method: req.method ?? "GET",
				path: req.url ?? "/",
				headers: req.headers as Record<string, string | string[]>,
				body,
				subdomain,
			};

			// Attribute usage to the tunnel that owns the request at dispatch time.
			const tunnel = tunnelManager.get(subdomain);
			const bytesIn = body ? Buffer.byteLength(body, "base64") : 0;

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
			tunnelManager.openStream(subdomain, tunnelReq, sink);
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
