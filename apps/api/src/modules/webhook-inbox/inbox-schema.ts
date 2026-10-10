import { ruleHeaderIssue } from "@localman/shared/endpoint-behavior";
import { z } from "zod";
import {
	portSchema,
	targetLabel,
	tunnelPathSchema,
} from "../mock-callbacks/outbound-target.js";

/** Path segment of every inbox: `/_inbox/<name>`. */
export const INBOX_SEGMENT = "_inbox";
/** Lowercase letters, digits and `-`, not at either end; 32 at most. */
export const INBOX_NAME = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
/** Bytes of a custom response body. */
export const MAX_INBOX_BODY_BYTES = 64 * 1024;
export const DEFAULT_INBOX_BODY = '{"received":true}';
export const DEFAULT_INBOX_CONTENT_TYPE = "application/json";
/** `type/subtype` with an optional `; charset=…`. */
const CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+(?:\s*;\s*charset=[\w-]+)?$/i;
/** What an inbox stored before the content type was limited answers as. */
export const FALLBACK_INBOX_CONTENT_TYPE = "text/plain";

/**
 * Whether an inbox may answer with `value`: the policy of rule response
 * headers (`ruleHeaderIssue`), JSON or `text/plain` only. The answer is
 * served on the mock origin, which `/m/` shares with the dashboard, so
 * never HTML, script or anything a browser renders.
 */
export function isInboxContentType(value: string): boolean {
	return (
		CONTENT_TYPE.test(value) &&
		ruleHeaderIssue("content-type", value, 200) === null
	);
}

/** The stored content type, or `text/plain` for one stored before the limit. */
export function inboxContentTypeOf(stored: string): string {
	return isInboxContentType(stored) ? stored : FALLBACK_INBOX_CONTENT_TYPE;
}

export const inboxNameSchema = z
	.string()
	.regex(INBOX_NAME, "must be lowercase letters, digits and -, 32 at most");

/**
 * The answer every sender gets. Status 200–599: an informational status
 * cannot end an HTTP exchange.
 */
export const inboxResponseSchema = z.object({
	status: z.number().int().min(200).max(599).default(200),
	contentType: z
		.string()
		.max(100)
		.refine(isInboxContentType, "must be application/json or text/plain")
		.default(DEFAULT_INBOX_CONTENT_TYPE),
	body: z
		.string()
		.refine(
			(text) => Buffer.byteLength(text) <= MAX_INBOX_BODY_BYTES,
			"must be at most 64 KB",
		)
		.default(DEFAULT_INBOX_BODY),
});

export const inboxForwardSchema = z.object({
	port: portSchema,
	path: tunnelPathSchema,
});

/** `tunnel:<port><path>`, the label of a forward in views and log lines. */
export function forwardLabel(forward: { port: number; path: string }): string {
	return targetLabel({
		kind: "tunnel",
		port: forward.port,
		path: forward.path,
	});
}
