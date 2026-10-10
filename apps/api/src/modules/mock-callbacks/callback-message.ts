import type { HeaderEntry } from "@localman/shared/api-client";
import { PROXY_MARKER_HEADER } from "../api-client/proxy-headers.js";
import type { CallbackEvent } from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import { UPSTREAM_HOP_HEADER } from "../mock-runtime/upstream-headers.js";
import { maskedCallbackHeaders, urlWithoutQuery } from "./callback-headers.js";
import type { StoredCallback } from "./callback-model.js";
import {
	MAX_CALLBACK_BODY_BYTES,
	type TemplateContext,
	renderTemplate,
} from "./callback-template.js";
import type { JobProject } from "./job-project.js";
import type { DeliveryResult, OutboundMessage } from "./outbound-send.js";
import { targetLabel } from "./outbound-target.js";

/** Callbacks always POST their rendered body. */
export const CALLBACK_METHOD = "POST";

export interface RenderedCallback {
	readonly message: OutboundMessage;
	/** `body_too_large`: the rendered body passed 64 KB and is not sent. */
	readonly failure: string | null;
}

/**
 * The request of a callback: its template rendered, `Content-Type:
 * application/json` unless the callback sets one, its headers, and
 * `X-Localman-Hop: 1` so a write it causes in a mock fires no callback.
 */
export function renderCallback(
	callback: Pick<StoredCallback, "target" | "bodyTemplate" | "headers">,
	context: TemplateContext,
): RenderedCallback {
	const body = Buffer.from(renderTemplate(callback.bodyTemplate, context));
	const tooLarge = body.length > MAX_CALLBACK_BODY_BYTES;
	const typed = callback.headers.some(
		(header) => header.name.toLowerCase() === "content-type",
	);
	const headers: HeaderEntry[] = [
		...(typed ? [] : [{ name: "Content-Type", value: "application/json" }]),
		...callback.headers.map(({ name, value }) => ({ name, value })),
		{ name: UPSTREAM_HOP_HEADER, value: "1" },
	];
	return {
		message: {
			target: callback.target,
			query: "",
			method: CALLBACK_METHOD,
			headers,
			body: tooLarge ? null : body,
		},
		failure: tooLarge ? "body_too_large" : null,
	};
}

/**
 * Logs a finished callback as one `callback` line: the path is the
 * target (`https://…` origin and path only, a query may be a token; or
 * `tunnel:<port><path>`), the status the last answer's (0 when none
 * came), with every attempt. The callback's own header values are masked
 * (see `maskedCallbackHeaders`).
 */
export function recordCallbackLine(
	project: JobProject,
	at: Date,
	event: CallbackEvent | undefined,
	message: OutboundMessage,
	result: DeliveryResult,
): void {
	const label =
		message.target.kind === "url"
			? urlWithoutQuery(message.target.url)
			: targetLabel(message.target);
	const { response } = result;
	requestLog.record({
		projectId: project.id,
		ownerPlan: project.ownerPlan,
		redactHeaders: [
			...project.redactHeaders,
			...maskedCallbackHeaders(message.headers),
		],
		at,
		method: message.method,
		path: label,
		query: "",
		status: response?.status ?? 0,
		ms: result.attempts.at(-1)?.ms ?? 0,
		source: "callback",
		request: {
			headers: [...message.headers, { name: PROXY_MARKER_HEADER, value: "1" }],
			body: message.body
				? { bytes: message.body, size: message.body.length }
				: null,
		},
		response: {
			headers: response?.headers ?? [],
			body: response
				? { bytes: response.body, size: response.body.length }
				: null,
		},
		...(event ? { event } : {}),
		target: label,
		attempts: result.attempts,
	});
}
