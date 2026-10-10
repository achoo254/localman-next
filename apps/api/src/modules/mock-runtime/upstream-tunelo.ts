import type { HeaderEntry } from "@localman/shared/api-client";
import type { OutboundFailure } from "./upstream-forwarder.js";

/**
 * Bodies Tunelo itself answers with when it cannot reach the developer's
 * app, always as bare `text/plain` (no charset):
 * - the tunnel server: `Tunnel not found: <label>` (502, the CLI is not
 *   connected), `Bad Gateway` (502) and `Gateway Timeout` (504) when the
 *   relay fails (`apps/tunelo-server/src/request-relay.ts`,
 *   `stream/response-sink.ts`);
 * - the CLI: `Local service unavailable` (502, connection refused),
 *   `Local service timeout` (502/504), `Local response error|aborted`,
 *   and the Node error of any other failed connection
 *   (`packages/tunelo-cli/src/{local-proxy,http-stream}.ts`).
 */
const TIMEOUT_BODIES = new Set(["Gateway Timeout", "Local service timeout"]);
const DOWN_BODIES = new Set([
	"Bad Gateway",
	"Local service unavailable",
	"Local response error",
	"Local response aborted",
]);
const TUNNEL_NOT_FOUND = /^Tunnel not found: [a-z0-9-]{1,63}$/;
/** `connect ECONNRESET 127.0.0.1:3000`, `read ETIMEDOUT`, `socket hang up`. */
const NODE_ERROR =
	/^(?:(?:connect|read|write|getaddrinfo) E[A-Z]+\b.*|socket hang up)$/;
/** Longest body worth reading as one of the above. */
const MAX_SIGNATURE_BYTES = 256;

export interface RelayedAnswer {
	readonly status: number;
	readonly headers: readonly HeaderEntry[];
	readonly body: Buffer;
}

function contentTypeOf(headers: readonly HeaderEntry[]): string | null {
	const found = headers.find(
		(header) => header.name.trim().toLowerCase() === "content-type",
	);
	return found ? found.value.trim().toLowerCase() : null;
}

/**
 * Why a tunnel upstream's answer is Tunelo saying the app is unreachable
 * (`connect` or `timeout`), or `null` when the developer's app answered,
 * including its own 502s: they carry a charset, another type or body.
 */
export function tuneloFailureOf(answer: RelayedAnswer): OutboundFailure | null {
	if (answer.status !== 502 && answer.status !== 504) return null;
	if (answer.body.length > MAX_SIGNATURE_BYTES) return null;
	if (contentTypeOf(answer.headers) !== "text/plain") return null;
	const text = answer.body.toString("utf8");
	if (TIMEOUT_BODIES.has(text)) return "timeout";
	if (answer.status !== 502) return null;
	const down =
		DOWN_BODIES.has(text) ||
		TUNNEL_NOT_FOUND.test(text) ||
		NODE_ERROR.test(text);
	return down ? "connect" : null;
}
