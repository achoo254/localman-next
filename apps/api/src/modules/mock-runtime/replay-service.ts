import { OperationError } from "@localman/operations";
import type { HeaderEntry } from "@localman/shared/api-client";
import { messagesFor } from "../../i18n/server-messages.js";
import { encodeBody } from "../api-client/proxy-response-body.js";
import type { SsrfGuard } from "../api-client/ssrf-guard.js";
import { mockBaseUrlOf } from "../projects/project-view.js";
import { readUserLocale } from "../users/user-locale.js";
import { REDACTED } from "./request-log-entry.js";
import type { StoredLogBody, StoredRequestLog } from "./request-log-model.js";
import {
	DEFAULT_FORWARD_TIMEOUT_MS,
	OutboundError,
	defaultOutboundGuard,
	forwardHttpRequest,
} from "./upstream-forwarder.js";
import { SOURCE_HEADER } from "./upstream-headers.js";

/** How a replay reaches the mock runtime. */
export interface ReplayDeps {
	readonly guard: SsrfGuard;
	/** Origin of a project's mock host, e.g. `https://{secret}.{domain}`. */
	readonly mockOrigin: (secret: string) => string;
	readonly timeoutMs: number;
}

export function defaultReplayDeps(): ReplayDeps {
	return {
		guard: defaultOutboundGuard(),
		mockOrigin: (secret) => mockBaseUrlOf(secret, ""),
		timeoutMs: DEFAULT_FORWARD_TIMEOUT_MS,
	};
}

/** What the mock answered to a replay. */
export interface ReplayResult {
	readonly status: number;
	readonly headers: HeaderEntry[];
	readonly body: string;
	readonly bodyEncoding: "utf8" | "base64";
	readonly size: number;
	readonly truncated: boolean;
	readonly ms: number;
	/** `X-Localman-Source` of the answer (`mock`, `upstream`), if any. */
	readonly source: string | null;
}

/** The bytes of a logged body. */
export function logBodyBytes(body: StoredLogBody): Buffer | null {
	if (body.size === 0) return null;
	return Buffer.from(
		body.body,
		body.bodyEncoding === "base64" ? "base64" : "utf8",
	);
}

/** Logged request headers that can be sent again: masked ones are dropped. */
export function replayableHeaders(line: StoredRequestLog): HeaderEntry[] {
	return line.request.headers.filter((h) => h.value !== REDACTED);
}

async function failure(
	sub: string,
	status: number,
	code: string,
	pick: "replayBodyTruncated" | "replayFailed",
): Promise<OperationError> {
	const texts = messagesFor(await readUserLocale(sub)).traffic;
	return new OperationError(status, code, texts[pick]);
}

/**
 * Sends the logged request again to the project's public mock URL, so it
 * goes through the real mock runtime: rate limits, the owner's monthly
 * quota, the upstream of a hybrid mock and a new log line. Masked headers
 * are not sent; a body cut in the log is refused (409).
 */
export async function replayLogLine(
	sub: string,
	line: StoredRequestLog,
	secret: string,
	deps: ReplayDeps,
	signal?: AbortSignal,
): Promise<ReplayResult> {
	if (line.request.truncated) {
		throw await failure(
			sub,
			409,
			"REPLAY_BODY_TRUNCATED",
			"replayBodyTruncated",
		);
	}
	const query = line.query ? `?${line.query}` : "";
	try {
		const response = await forwardHttpRequest(
			{
				url: `${deps.mockOrigin(secret)}${line.path}${query}`,
				method: line.method,
				headers: replayableHeaders(line),
				body: logBodyBytes(line.request),
				timeoutMs: deps.timeoutMs,
				...(signal ? { signal } : {}),
			},
			deps.guard,
		);
		const source = response.headers.find(
			(h) => h.name.toLowerCase() === SOURCE_HEADER.toLowerCase(),
		);
		return {
			status: response.status,
			headers: response.headers,
			...encodeBody(response.body, response.truncated),
			truncated: response.truncated,
			ms: response.ms,
			source: source?.value ?? null,
		};
	} catch (error) {
		if (!(error instanceof OutboundError)) throw error;
		throw await failure(sub, 502, "REPLAY_FAILED", "replayFailed");
	}
}
