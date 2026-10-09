/**
 * Sends a prepared request straight from the browser with `fetch`: no
 * cookies of the page (`credentials: "omit"`), the tab's timeout, and the
 * response read into the same shape the proxy returns. The browser only
 * says `TypeError` when it refuses (CORS, mixed content, Local Network
 * Access, network down), so that is all this reports. Only a `fetch`
 * refused before any response is `blocked`: once a response arrived the
 * target ran the request, so a body that breaks off is `interrupted` and
 * must never be sent again on its own.
 */
import {
	type ClientResponse,
	type HeaderEntry,
	MAX_RESPONSE_BODY_BYTES,
	type PreparedRequest,
	bytesToBase64,
	decodeUtf8OrNull,
	isForbiddenRequestHeader,
} from "@localman/shared/api-client";
import { readTimings } from "./direct-timings";

export interface DirectOptions {
	timeoutMs: number;
	followRedirects: boolean;
	/** Local target: tells Chrome's Local Network Access what to expect. */
	addressSpace: "loopback" | "local" | null;
	signal: AbortSignal;
}

export type DirectOutcome =
	| { kind: "response"; response: ClientResponse; dropped: string[] }
	| { kind: "blocked" }
	| { kind: "timeout" }
	| { kind: "redirect" }
	/** The target answered, then reading the body failed. */
	| { kind: "interrupted" }
	| { kind: "cancelled" };

/** `RequestInit` plus the Local Network Access hint (Chrome 142+). */
interface LocalNetworkInit extends RequestInit {
	targetAddressSpace?: "loopback" | "local";
}

function requestBody(prepared: PreparedRequest): BodyInit | undefined {
	const { body } = prepared;
	if (body.kind === "none") return undefined;
	if (body.kind === "text") return body.text;
	return body.bytes.slice().buffer;
}

/** Headers `fetch` accepts; the others are reported as dropped. */
function splitHeaders(prepared: PreparedRequest): {
	headers: Headers;
	dropped: string[];
} {
	const headers = new Headers();
	const dropped: string[] = [];
	for (const { name, value } of prepared.headers) {
		if (isForbiddenRequestHeader(name, value)) {
			if (!dropped.includes(name)) dropped.push(name);
			continue;
		}
		headers.append(name, value);
	}
	return { headers, dropped };
}

/** Reads at most `MAX_RESPONSE_BODY_BYTES`; `truncated` when there was more. */
async function readBody(
	response: Response,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
	const reader = response.body?.getReader();
	if (!reader) return { bytes: new Uint8Array(), truncated: false };
	const chunks: Uint8Array[] = [];
	let size = 0;
	let truncated = false;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		const room = MAX_RESPONSE_BODY_BYTES - size;
		if (value.byteLength > room) {
			chunks.push(value.subarray(0, room));
			size += room;
			truncated = true;
			await reader.cancel();
			break;
		}
		chunks.push(value);
		size += value.byteLength;
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { bytes, truncated };
}

function responseHeaders(response: Response): HeaderEntry[] {
	const out: HeaderEntry[] = [];
	response.headers.forEach((value, name) => out.push({ name, value }));
	return out;
}

function toClientResponse(
	response: Response,
	body: { bytes: Uint8Array; truncated: boolean },
	fallbackUrl: string,
	started: number,
): ClientResponse {
	const text = decodeUtf8OrNull(body.bytes);
	const finalUrl = response.url || fallbackUrl;
	return {
		status: response.status,
		statusText: response.statusText,
		headers: responseHeaders(response),
		body: text ?? bytesToBase64(body.bytes),
		bodyEncoding: text === null ? "base64" : "utf8",
		size: body.bytes.byteLength,
		timings: readTimings(finalUrl, started, performance.now()),
		finalUrl,
		truncated: body.truncated,
	};
}

export async function directFetch(
	prepared: PreparedRequest,
	options: DirectOptions,
): Promise<DirectOutcome> {
	const { headers, dropped } = splitHeaders(prepared);
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, options.timeoutMs);
	const onAbort = () => controller.abort();
	options.signal.addEventListener("abort", onAbort, { once: true });
	const init: LocalNetworkInit = {
		method: prepared.method,
		headers,
		body: requestBody(prepared),
		credentials: "omit",
		mode: "cors",
		redirect: options.followRedirects ? "follow" : "manual",
		signal: controller.signal,
		...(options.addressSpace
			? { targetAddressSpace: options.addressSpace }
			: {}),
	};
	const started = performance.now();
	const stopped = (): DirectOutcome | null => {
		if (options.signal.aborted) return { kind: "cancelled" };
		return timedOut ? { kind: "timeout" } : null;
	};
	try {
		if (options.signal.aborted) return { kind: "cancelled" };
		let response: Response;
		try {
			response = await fetch(prepared.url, init);
		} catch (error) {
			// Refused before any response: nothing reached the target.
			const blocked: DirectOutcome = { kind: "blocked" };
			return (
				stopped() ??
				(error instanceof TypeError ? blocked : { kind: "interrupted" })
			);
		}
		if (response.type === "opaqueredirect") return { kind: "redirect" };
		try {
			const body = await readBody(response);
			const client = toClientResponse(response, body, prepared.url, started);
			return { kind: "response", dropped, response: client };
		} catch {
			// The target already answered: report it, never resend.
			return stopped() ?? { kind: "interrupted" };
		}
	} finally {
		clearTimeout(timer);
		options.signal.removeEventListener("abort", onAbort);
	}
}
