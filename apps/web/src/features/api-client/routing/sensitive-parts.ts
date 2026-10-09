/**
 * Credentials a request carries, by name only. One detector for two jobs:
 * what the router asks about before it switches a request to the proxy or
 * a tunnel on its own, and what history hides before a send is recorded
 * (`history/redact-draft.ts`). Covers the Authorization tab, headers and
 * query params whose name says credential (`Authorization`, `Cookie`,
 * `X-API-Key`, `access_token`, `client_secret`…), and `{{var}}` values of
 * secret variables.
 */
import {
	type ApiRequestDraft,
	type PreparedRequest,
	VARIABLE_PATTERN,
	parseHttpUrl,
} from "@localman/shared/api-client";

/** Whole names that carry a credential. */
const CREDENTIAL_NAMES: ReadonlySet<string> = new Set([
	"authorization",
	"proxy-authorization",
	"cookie",
	"auth",
	"sig",
	"signature",
	"password",
	"passwd",
	"pwd",
]);

/** A word of the name containing one of these carries a credential. */
const CREDENTIAL_WORDS = [
	"token",
	"secret",
	"passw",
	"credential",
	"signature",
];

/** `X-API-Key` → `x api key`, `apiKey` → `api key`. */
function words(name: string): string[] {
	return name
		.trim()
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((word) => word !== "");
}

/**
 * A header, query param or field name that holds a credential: the names
 * above, `x-auth…`, any word ending in `key` (`X-API-Key`, `apikey`) or
 * containing `token`, `secret`, `passw`, `credential` or `signature`.
 */
export function isSensitiveName(name: string): boolean {
	const lower = name.trim().toLowerCase();
	if (lower === "") return false;
	if (CREDENTIAL_NAMES.has(lower) || lower.startsWith("x-auth")) return true;
	return words(name).some(
		(word) =>
			word.endsWith("key") ||
			CREDENTIAL_WORDS.some((part) => word.includes(part)),
	);
}

/** Typed in as is: not empty and no `{{var}}` reference in it. */
export function isLiteralValue(value: string): boolean {
	return (
		value.trim() !== "" && !new RegExp(VARIABLE_PATTERN.source).test(value)
	);
}

/** Query params of the prepared URL whose name holds a credential. */
function sensitiveQuery(url: string): string[] {
	const parsed = parseHttpUrl(url);
	if (!parsed) return [];
	const names: string[] = [];
	parsed.searchParams.forEach((value, name) => {
		if (value.trim() !== "" && isSensitiveName(name)) names.push(`?${name}`);
	});
	return names;
}

/** Names to show (`Authorization`, `X-API-Key`, `?access_token`, `{{token}}`), no values. */
export function sensitiveParts(
	draft: ApiRequestDraft,
	prepared: PreparedRequest,
): string[] {
	const parts: string[] = [];
	const add = (name: string): void => {
		const lower = name.toLowerCase();
		if (!parts.some((part) => part.toLowerCase() === lower)) parts.push(name);
	};
	for (const { name, value } of prepared.headers) {
		if (value.trim() !== "" && isSensitiveName(name)) add(name.trim());
	}
	// An API key set in the Authorization tab counts whatever its name.
	if (draft.auth.type === "apikey" && draft.auth.key.trim()) {
		const key = draft.auth.key.trim();
		add(draft.auth.in === "query" ? `?${key}` : key);
	}
	for (const name of sensitiveQuery(prepared.url)) add(name);
	for (const name of prepared.secretsUsed) add(`{{${name}}}`);
	return parts;
}
