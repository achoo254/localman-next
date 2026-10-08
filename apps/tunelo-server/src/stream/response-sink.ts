import type http from "node:http";
import {
	ErrorCode,
	needsUnbufferedRelay,
	stripHopByHopHeaders,
} from "@tunelo/shared";
import { createLogger } from "../logger.js";
import type { StreamSink } from "./stream-registry.js";

const logger = createLogger("tunelo-relay");

/**
 * Build a sink that streams a relayed response straight into the HTTP response:
 * write headers on start, each chunk as it arrives, end on completion. This is
 * what makes SSE / chunked responses work — nothing is buffered whole.
 * `onComplete` fires exactly once with the bytes written, for usage tracking.
 */
export function createResponseSink(
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
