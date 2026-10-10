import type { IncomingMessage } from "node:http";
import { STATUS_CODES } from "node:http";
import {
	type ClientResponse,
	type HeaderEntry,
	MAX_REDIRECTS,
	type ProxyRequest,
	parseHttpUrl,
} from "@localman/shared/api-client";
import { toProxyError, tooManyRedirects } from "./proxy-errors.js";
import {
	buildOutgoingHeaders,
	fromRawHeaders,
	headersForRedirect,
} from "./proxy-headers.js";
import { type HopResponse, sendHop } from "./proxy-hop.js";
import { encodeBody, readResponseBody } from "./proxy-response-body.js";
import type { SsrfGuard } from "./ssrf-guard.js";

export interface ForwardOptions {
	readonly guard: SsrfGuard;
	/** Caller's address (`ctx.clientIp`); forwarded when the envelope allows. */
	readonly clientIp: string | null;
	/** Scheme the caller used to reach Localman, for `Forwarded: proto=`. */
	readonly forwardedProto: string;
	/** Aborts when the caller goes away; the upstream request stops too. */
	readonly signal?: AbortSignal;
}

/** The request of one hop; redirects derive the next one from it. */
export interface HopState {
	readonly method: string;
	readonly url: URL;
	readonly headers: readonly HeaderEntry[];
	readonly body: Buffer | null;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** Methods that send `Content-Length: 0` without a body (RFC 9110 §8.6). */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function bodyOf(envelope: ProxyRequest): Buffer | null {
	if (envelope.body === null || envelope.bodyType === "none") return null;
	return Buffer.from(
		envelope.body,
		envelope.bodyType === "base64" ? "base64" : "utf8",
	);
}

/** Where a redirect leads, or `null` when it cannot be followed. */
function redirectTarget(response: IncomingMessage, from: URL): URL | null {
	if (!REDIRECT_STATUSES.has(response.statusCode ?? 0)) return null;
	const location = response.headers.location;
	if (!location) return null;
	try {
		return parseHttpUrl(new URL(location, from).href);
	} catch {
		return null;
	}
}

/**
 * The next hop of a redirect, as browsers do: 303 (and 301/302 after a
 * POST) turns into a GET without body; another origin loses credentials.
 */
function nextHop(state: HopState, status: number, to: URL): HopState {
	const toGet =
		(status === 303 && state.method !== "HEAD") ||
		((status === 301 || status === 302) && state.method === "POST");
	const crossOrigin = to.origin !== state.url.origin;
	return {
		method: toGet ? "GET" : state.method,
		url: to,
		headers: headersForRedirect(state.headers, crossOrigin, toGet),
		body: toGet ? null : state.body,
	};
}

function contentLengthOf(state: HopState): number | null {
	if (state.body) return state.body.length;
	return BODY_METHODS.has(state.method) ? 0 : null;
}

/** `work`, or a rejection as soon as `signal` aborts. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		if (signal.aborted) return reject(signal.reason);
		const onAbort = (): void => reject(signal.reason);
		signal.addEventListener("abort", onAbort, { once: true });
		work.then(resolve, reject).finally(() => {
			signal.removeEventListener("abort", onAbort);
		});
	});
}

/**
 * Sends one hop: pins the URL's address through the SSRF guard (bounded
 * by `signal`, so a slow DNS answer cannot outlive the deadline), builds
 * the outgoing headers and connects to the pinned address. Shared with
 * the mock runtime's upstream forwarder.
 */
export async function sendChecked(
	state: HopState,
	options: ForwardOptions,
	clientIp: string | null,
	signal: AbortSignal,
): Promise<HopResponse> {
	const startedAt = performance.now();
	// The deadline also bounds a slow DNS answer.
	const target = await untilAborted(options.guard.pin(state.url), signal);
	const headers = buildOutgoingHeaders(state.headers, {
		url: state.url,
		clientIp,
		forwardedProto: options.forwardedProto,
		contentLength: contentLengthOf(state),
		forceHost: target.forceHost,
	});
	return sendHop({ ...state, headers, target, signal, startedAt });
}

/**
 * Sends the envelope's request and returns the upstream response as the
 * API client shows it. Every hop (the first and each redirect) passes the
 * SSRF guard and connects to the address it pinned; at most
 * `MAX_REDIRECTS` redirects are followed when `followRedirects` is on,
 * otherwise the 3xx itself is the answer. The whole exchange, body read
 * included, shares one deadline of `timeoutMs`, and stops as soon as
 * `options.signal` aborts.
 */
export async function forwardRequest(
	envelope: ProxyRequest,
	options: ForwardOptions,
): Promise<ClientResponse> {
	const { followRedirects, timeoutMs, sendClientIp } = envelope.options;
	const deadline = AbortSignal.timeout(timeoutMs);
	const signal = options.signal
		? AbortSignal.any([deadline, options.signal])
		: deadline;
	const clientIp = sendClientIp ? options.clientIp : null;
	const started = performance.now();
	let state: HopState = {
		method: envelope.method,
		url: new URL(envelope.url),
		headers: envelope.headers,
		body: bodyOf(envelope),
	};
	try {
		for (let redirects = 0; ; redirects++) {
			const { response, timings } = await sendChecked(
				state,
				options,
				clientIp,
				signal,
			);
			const status = response.statusCode ?? 0;
			const next = followRedirects ? redirectTarget(response, state.url) : null;
			if (next) {
				response.resume();
				response.destroy();
				if (redirects >= MAX_REDIRECTS) throw tooManyRedirects();
				state = nextHop(state, status, next);
				continue;
			}
			const read = await readResponseBody(response);
			return {
				status,
				statusText: response.statusMessage ?? STATUS_CODES[status] ?? "",
				headers: fromRawHeaders(response.rawHeaders),
				...encodeBody(read.bytes, read.truncated),
				timings: { ...timings, total: performance.now() - started },
				finalUrl: state.url.href,
				truncated: read.truncated,
			};
		}
	} catch (error) {
		throw toProxyError(error, deadline, timeoutMs);
	}
}
