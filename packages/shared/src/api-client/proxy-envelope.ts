/**
 * Envelope of `client.sendRequest` (`POST /api/v1/proxy`, MCP tool
 * `send_request`): the request to forward as JSON in, the upstream
 * response as JSON out. Header lists keep order and repeated names;
 * binary bodies travel as base64.
 */
import { z } from "zod";
import {
	base64DecodedLength,
	bytesToBase64,
	isBase64,
	utf8ByteLength,
} from "./byte-encoding.js";
import { isValidHeaderName, isValidHeaderValue } from "./header-rules.js";
import {
	DEFAULT_TIMEOUT_MS,
	MAX_HEADERS,
	MAX_HEADER_NAME_LENGTH,
	MAX_HEADER_VALUE_LENGTH,
	MAX_REQUEST_BODY_BYTES,
	MAX_TIMEOUT_MS,
	MAX_URL_LENGTH,
	MIN_TIMEOUT_MS,
} from "./limits.js";
import { HTTP_METHODS, type RequestSettings } from "./request-model.js";
import type { PreparedRequest } from "./request-preparer.js";
import { BODY_ENCODINGS, type ClientResponse } from "./response-model.js";
import { parseHttpUrl } from "./url-params.js";

/** How `body` is encoded in the envelope. */
export const PROXY_BODY_TYPES = ["none", "text", "base64"] as const;
export type ProxyBodyType = (typeof PROXY_BODY_TYPES)[number];

export const headerEntrySchema = z.object({
	name: z
		.string()
		.min(1)
		.max(MAX_HEADER_NAME_LENGTH)
		.refine(isValidHeaderName, "Invalid header name"),
	value: z
		.string()
		.max(MAX_HEADER_VALUE_LENGTH)
		.refine(isValidHeaderValue, "Header value cannot contain CR, LF or NUL"),
});

const DEFAULT_OPTIONS = {
	followRedirects: true,
	timeoutMs: DEFAULT_TIMEOUT_MS,
	sendClientIp: true,
};

/**
 * Where the server finds the values of `{{variables}}` in the request
 * (ADR-0009): the workspace's globals, then the collection's variables,
 * then the environment, each with the caller's local values first. Used
 * by agents, which never read secret values; the browser fills them itself.
 */
export const proxyVariablesSchema = z.object({
	workspaceId: z.string().min(1).max(64),
	collectionId: z.string().min(1).max(64).nullable().optional(),
	environmentId: z.string().min(1).max(64).nullable().optional(),
});
export type ProxyVariables = z.infer<typeof proxyVariablesSchema>;

export const proxyRequestSchema = z
	.object({
		method: z.enum(HTTP_METHODS),
		/** Absolute http(s), checked below once any `{{variables}}` are filled. */
		url: z.string().min(1).max(MAX_URL_LENGTH),
		headers: z.array(headerEntrySchema).max(MAX_HEADERS).default([]),
		body: z.string().nullable().default(null),
		bodyType: z.enum(PROXY_BODY_TYPES).default("none"),
		options: z
			.object({
				followRedirects: z.boolean().default(DEFAULT_OPTIONS.followRedirects),
				timeoutMs: z
					.number()
					.int()
					.min(MIN_TIMEOUT_MS)
					.max(MAX_TIMEOUT_MS)
					.default(DEFAULT_OPTIONS.timeoutMs),
				sendClientIp: z.boolean().default(DEFAULT_OPTIONS.sendClientIp),
			})
			.default(DEFAULT_OPTIONS),
		variables: proxyVariablesSchema.optional(),
	})
	.superRefine((envelope, ctx) => {
		// With `variables` the URL may be a template; the server checks it
		// again after filling it.
		if (!envelope.variables && parseHttpUrl(envelope.url) === null) {
			ctx.addIssue({
				code: "custom",
				path: ["url"],
				message: "URL must be absolute http or https",
			});
		}
		const issue = (message: string): void => {
			ctx.addIssue({ code: "custom", path: ["body"], message });
		};
		const { body, bodyType, method } = envelope;
		if (bodyType === "none") {
			if (body) issue("body must be null when bodyType is none");
			return;
		}
		if (body === null)
			return issue(`body is required when bodyType is ${bodyType}`);
		if (method === "GET" || method === "HEAD") {
			return issue(`${method} requests cannot carry a body`);
		}
		if (bodyType === "base64" && !isBase64(body)) {
			return issue("body is not valid base64");
		}
		const bytes =
			bodyType === "base64" ? base64DecodedLength(body) : utf8ByteLength(body);
		if (bytes > MAX_REQUEST_BODY_BYTES) {
			issue(`body exceeds ${MAX_REQUEST_BODY_BYTES} bytes`);
		}
	});

/** What the caller sends (defaults still optional). */
export type ProxyRequestInput = z.input<typeof proxyRequestSchema>;
/** What the proxy works with after parsing. */
export type ProxyRequest = z.output<typeof proxyRequestSchema>;

const nullableMs = z.number().min(0).nullable();

export const proxyResponseSchema: z.ZodType<ClientResponse> = z.object({
	status: z.number().int(),
	statusText: z.string(),
	headers: z.array(z.object({ name: z.string(), value: z.string() })),
	body: z.string(),
	bodyEncoding: z.enum(BODY_ENCODINGS),
	size: z.number().int().min(0),
	timings: z.object({
		dns: nullableMs,
		connect: nullableMs,
		tls: nullableMs,
		ttfb: nullableMs,
		total: z.number().min(0),
	}),
	finalUrl: z.string(),
	truncated: z.boolean(),
});

/** Envelope for a prepared request, with the tab's per-request options. */
export function toProxyEnvelope(
	prepared: PreparedRequest,
	settings: Pick<
		RequestSettings,
		"followRedirects" | "timeoutMs" | "sendClientIp"
	>,
): ProxyRequest {
	const { body } = prepared;
	const encoded =
		body.kind === "none"
			? { body: null, bodyType: "none" as const }
			: body.kind === "text"
				? { body: body.text, bodyType: "text" as const }
				: { body: bytesToBase64(body.bytes), bodyType: "base64" as const };
	return {
		method: prepared.method,
		url: prepared.url,
		headers: prepared.headers.map(({ name, value }) => ({ name, value })),
		...encoded,
		options: {
			followRedirects: settings.followRedirects,
			timeoutMs: settings.timeoutMs,
			sendClientIp: settings.sendClientIp,
		},
	};
}
