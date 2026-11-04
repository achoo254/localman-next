/**
 * HTTP answers written straight onto an upgrade socket, in place of `101`.
 *
 * The bytes go out raw, so nothing from the tunnel client is written without
 * a syntax check: a CR/LF in a header or status text would let a client
 * append a response of its own (response splitting).
 */
import http from "node:http";
import type { Duplex } from "node:stream";
import { DEFAULTS, type WsOpenResultMessage } from "@tunelo/shared";

type WsOpenRefusal = Extract<WsOpenResultMessage, { ok: false }>;

/** RFC 9110 token: a header name. */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** Visible ASCII, space and tab: no CR, LF or other control bytes. */
const HEADER_VALUE = /^[\t\x20-\x7e]*$/;
const STATUS_TEXT = /^[\x20-\x7e]{1,64}$/;
const MAX_HEADER_VALUE = 4096;
const MAX_HEADERS_BYTES = 8192;

/**
 * Headers the relay owns or that would change how the bytes are framed —
 * the relay writes its own `content-length` and `connection: close` — plus
 * the handshake headers, which mean nothing on a refusal.
 */
const DROPPED = new Set([
	"connection",
	"keep-alive",
	"proxy-authenticate",
	"proxy-authorization",
	"proxy-connection",
	"te",
	"trailer",
	"trailers",
	"transfer-encoding",
	"upgrade",
	"content-length",
	"content-encoding",
	"sec-websocket-accept",
	"sec-websocket-protocol",
	"sec-websocket-extensions",
	"sec-websocket-version",
]);

function writeResponse(
	socket: Duplex,
	statusLine: string,
	headers: Array<[string, string]>,
	body: Buffer,
): void {
	const head = [
		...headers,
		["content-length", String(body.length)],
		["connection", "close"],
	]
		.map(([name, value]) => `${name}: ${value}\r\n`)
		.join("");
	socket.write(`HTTP/1.1 ${statusLine}\r\n${head}\r\n`);
	if (body.length > 0) socket.write(body);
	socket.destroy();
}

/**
 * Refuse a WebSocket upgrade with a real HTTP response.
 *
 * Destroying the socket without writing anything leaves the peer reading a
 * response header that never arrives: a reverse proxy reports "upstream
 * prematurely closed connection" and the browser sees a reset instead of a
 * status it can act on. Mirrors the plain-HTTP relay, which answers the same
 * conditions with 400/502.
 */
export function rejectUpgrade(
	socket: Duplex,
	statusLine: string,
	message: string,
	extraHeaders: Record<string, string> = {},
): void {
	writeResponse(
		socket,
		statusLine,
		[["content-type", "text/plain"], ...Object.entries(extraHeaders)],
		Buffer.from(`${message}\n`),
	);
}

/** The app's headers that are safe to repeat to the browser. */
function relayableHeaders(
	headers: Record<string, string | string[]> | undefined,
): Array<[string, string]> {
	const out: Array<[string, string]> = [];
	let bytes = 0;
	for (const [rawName, rawValue] of Object.entries(headers ?? {})) {
		const name = rawName.toLowerCase();
		if (DROPPED.has(name) || !HEADER_NAME.test(name)) continue;
		for (const value of Array.isArray(rawValue) ? rawValue : [rawValue]) {
			if (value.length > MAX_HEADER_VALUE || !HEADER_VALUE.test(value)) {
				continue;
			}
			bytes += name.length + value.length + 4;
			if (bytes > MAX_HEADERS_BYTES) return out;
			out.push([name, value]);
		}
	}
	return out;
}

/** A status the browser may receive for a refused upgrade, else null. */
function refusalStatus(status: number): number | null {
	return Number.isInteger(status) && status >= 200 && status <= 599
		? status
		: null;
}

/** Answer the browser with the app's own refusal of the handshake. */
export function writeAppRefusal(socket: Duplex, refusal: WsOpenRefusal): void {
	const status = refusalStatus(refusal.status);
	if (status === null) {
		rejectUpgrade(socket, "502 Bad Gateway", "Bad Gateway");
		return;
	}
	const text =
		refusal.statusText && STATUS_TEXT.test(refusal.statusText)
			? refusal.statusText
			: (http.STATUS_CODES[status] ?? "Error");
	const body = Buffer.from(refusal.body ?? "", "base64").subarray(
		0,
		DEFAULTS.WS_APP_REJECT_BODY_MAX,
	);
	writeResponse(
		socket,
		`${status} ${text}`,
		relayableHeaders(refusal.headers),
		body,
	);
}
