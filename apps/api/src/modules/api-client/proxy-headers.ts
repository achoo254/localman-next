import { isIP } from "node:net";
import { type HeaderEntry, stripHopByHop } from "@localman/shared/api-client";

export interface OutgoingOptions {
	readonly url: URL;
	/** Caller's address to forward; `null` when unknown or turned off. */
	readonly clientIp: string | null;
	/** Scheme the caller used to reach Localman (`Forwarded: proto=`). */
	readonly forwardedProto: string;
	/** Body length in bytes; `null` sends no `Content-Length`. */
	readonly contentLength: number | null;
	/** `Host` must be the URL's host, the user's override is dropped. */
	readonly forceHost: boolean;
}

/**
 * Marks every proxied request, whatever the user wrote: other services on
 * the server (nginx `allow <server IP>` locations, apps on the same host)
 * refuse requests carrying it, since the proxy egresses from that IP.
 */
export const PROXY_MARKER_HEADER = "X-Localman-Proxy";

const lower = (name: string): string => name.trim().toLowerCase();

/** `::ffff:1.2.3.4` → `1.2.3.4` and no zone id, as targets expect. */
export function normalizeClientIp(ip: string): string {
	const bare = ip.split("%")[0] ?? ip;
	return /^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(bare) ? bare.slice(7) : bare;
}

/** RFC 7239 node: IPv6 is quoted and bracketed. */
function forwardedNode(ip: string): string {
	return isIP(ip) === 6 ? `"[${ip}]"` : ip;
}

/**
 * Appends `addition` to the last header named `name` (a comma list), or
 * adds the header at the end when there is none.
 */
function appendToList(
	headers: HeaderEntry[],
	name: string,
	addition: string,
): HeaderEntry[] {
	let at = -1;
	headers.forEach((h, i) => {
		if (lower(h.name) === lower(name)) at = i;
	});
	if (at === -1) return [...headers, { name, value: addition }];
	return headers.map((h, i) =>
		i === at ? { name: h.name, value: `${h.value}, ${addition}` } : h,
	);
}

/**
 * Headers sent to the target. Only the envelope's headers are used (never
 * the caller's request to Localman, so its session cookie and auth stay
 * home), in order with repeats, minus hop-by-hop ones. `Host` comes first:
 * the user's own value when given (unless `forceHost`), else the URL's.
 * `Content-Length` is always the real body length. With a client IP,
 * `X-Forwarded-For` and `Forwarded` get it appended (both are lists) and
 * `X-Real-IP` is set unless the user wrote one. `X-Localman-Proxy: 1`
 * always ends the list; a user header of that name is dropped.
 */
export function buildOutgoingHeaders(
	envelope: readonly HeaderEntry[],
	options: OutgoingOptions,
): HeaderEntry[] {
	const marker = lower(PROXY_MARKER_HEADER);
	const kept = stripHopByHop(envelope).filter(
		(h) => lower(h.name) !== "content-length" && lower(h.name) !== marker,
	);
	const userHost = options.forceHost
		? undefined
		: kept.find((h) => lower(h.name) === "host");
	let headers: HeaderEntry[] = [
		{
			name: userHost?.name ?? "Host",
			value: userHost?.value ?? options.url.host,
		},
		...kept.filter((h) => lower(h.name) !== "host"),
	];
	if (options.clientIp) {
		const ip = normalizeClientIp(options.clientIp);
		headers = appendToList(headers, "X-Forwarded-For", ip);
		if (!headers.some((h) => lower(h.name) === "x-real-ip")) {
			headers.push({ name: "X-Real-IP", value: ip });
		}
		headers = appendToList(
			headers,
			"Forwarded",
			`for=${forwardedNode(ip)};proto=${options.forwardedProto}`,
		);
	}
	if (options.contentLength !== null) {
		headers.push({
			name: "Content-Length",
			value: String(options.contentLength),
		});
	}
	headers.push({ name: PROXY_MARKER_HEADER, value: "1" });
	return headers;
}

/** Fetch's request-body header names, dropped when a redirect drops the body. */
const BODY_HEADERS = new Set([
	"content-encoding",
	"content-language",
	"content-location",
	"content-type",
]);

/** Credentials that must not follow a redirect to another origin. */
const CROSS_ORIGIN_DROPPED = new Set(["authorization", "cookie", "host"]);

/**
 * Envelope headers for the next hop of a redirect. Another origin loses
 * `Authorization`, `Cookie` and a `Host` override; a body dropped by the
 * method change takes its content headers along.
 */
export function headersForRedirect(
	headers: readonly HeaderEntry[],
	crossOrigin: boolean,
	bodyDropped: boolean,
): HeaderEntry[] {
	return headers.filter((h) => {
		const name = lower(h.name);
		if (crossOrigin && CROSS_ORIGIN_DROPPED.has(name)) return false;
		return !(bodyDropped && BODY_HEADERS.has(name));
	});
}

/** Flat `[name, value, name, value…]` list for `http.request`, order kept. */
export function toRawHeaders(headers: readonly HeaderEntry[]): string[] {
	return headers.flatMap((h) => [h.name, h.value]);
}

/** `IncomingMessage.rawHeaders` as header lines, order and repeats kept. */
export function fromRawHeaders(raw: readonly string[]): HeaderEntry[] {
	const lines: HeaderEntry[] = [];
	for (let i = 0; i + 1 < raw.length; i += 2) {
		lines.push({ name: raw[i] ?? "", value: raw[i + 1] ?? "" });
	}
	return lines;
}
