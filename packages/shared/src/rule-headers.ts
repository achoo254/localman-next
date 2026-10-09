import { z } from "zod";

export const MAX_RULE_HEADERS = 20;
export const MAX_HEADER_NAME_LENGTH = 100;
export const MAX_RULE_HEADER_VALUE_LENGTH = 1_024;

/**
 * Response headers a rule may set besides `x-*`: caching, retry and
 * language hints, the content type (JSON or plain text only, see
 * `ruleHeaderIssue`) and `location` on a 3xx. Anything else (framing,
 * cookies, CORS, security policies, reporting, auth challenges…) stays
 * with the platform: an allowlist, so headers browsers learn later are
 * refused by default.
 */
export const ALLOWED_RULE_HEADERS: readonly string[] = [
	"retry-after",
	"cache-control",
	"etag",
	"last-modified",
	"expires",
	"content-language",
	"content-type",
	"location",
];
/** `x-*` headers a rule may not set: proxy, security and platform ones. */
export const RESERVED_X_HEADERS: readonly string[] = [
	"x-request-id",
	"x-frame-options",
	"x-content-type-options",
];
export const RESERVED_X_PREFIXES: readonly string[] = [
	"x-localman-",
	"x-forwarded-",
];

/** RFC 9110 token. */
export const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
/** Visible ASCII, space and tab: no CR/LF (header injection). */
export const HEADER_VALUE_PATTERN = /^[\t\x20-\x7e]*$/;

/** Whether a rule may set the header `name` (lower case) at all. */
export function isRuleHeaderName(name: string): boolean {
	if (name.startsWith("x-")) {
		return (
			!RESERVED_X_HEADERS.includes(name) &&
			!RESERVED_X_PREFIXES.some((prefix) => name.startsWith(prefix))
		);
	}
	return ALLOWED_RULE_HEADERS.includes(name);
}

/** `application/json`, `application/…+json` or `text/plain`, any params. */
function isJsonOrText(contentType: string): boolean {
	const media = (contentType.split(";")[0] ?? "").trim().toLowerCase();
	if (media === "application/json" || media === "text/plain") return true;
	const subtype = media.startsWith("application/") ? media.slice(12) : "";
	return /^[a-z0-9][a-z0-9.+-]*\+json$/.test(subtype);
}

/**
 * - `reserved`: a rule cannot set this header;
 * - `location`: `location` only goes with a 3xx status;
 * - `contentType`: the body is JSON, so only a JSON type or `text/plain`
 *   (never HTML on the mock origin).
 */
export type RuleHeaderIssue = "reserved" | "location" | "contentType";

/** Why a rule answering `status` may not send `name: value`, or `null`. */
export function ruleHeaderIssue(
	name: string,
	value: string,
	status: number,
): RuleHeaderIssue | null {
	if (!isRuleHeaderName(name)) return "reserved";
	if (name === "location" && (status < 300 || status > 399)) return "location";
	if (name === "content-type" && !isJsonOrText(value)) return "contentType";
	return null;
}

export const headerNameSchema = z
	.string()
	.min(1)
	.max(MAX_HEADER_NAME_LENGTH)
	.regex(HEADER_NAME_PATTERN, "Not a valid header name")
	.transform((name) => name.toLowerCase());

/** A response header a rule sets; `ruleHeaderIssue` is checked with the status. */
export const ruleHeaderSchema = z.object({
	name: headerNameSchema.refine(
		isRuleHeaderName,
		"This header cannot be set by a rule",
	),
	value: z
		.string()
		.max(MAX_RULE_HEADER_VALUE_LENGTH)
		.regex(HEADER_VALUE_PATTERN, "Header values hold printable ASCII only"),
});
