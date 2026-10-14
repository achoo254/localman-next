/**
 * Credentials a request carries, by name only. One detector for every
 * place that hides or asks about a credential: the router before it
 * switches a request to the proxy or a tunnel, history before a send is
 * recorded, and the public views of a collection (`public-collection.ts`).
 * Covers header, query param and field names that say credential
 * (`Authorization`, `Cookie`, `Set-Cookie`, `X-API-Key`, `access_token`,
 * `client_secret`…).
 */
import { VARIABLE_PATTERN } from "../variable-interpolation.js";

/** Whole names that carry a credential. */
const CREDENTIAL_NAMES: ReadonlySet<string> = new Set([
	"authorization",
	"proxy-authorization",
	"www-authenticate",
	"cookie",
	"set-cookie",
	"authentication",
	"bearer",
	"jwt",
	"sid",
	"phpsessid",
	"jsessionid",
	"assertion",
	"code_verifier",
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
	"session",
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
 * containing `token`, `secret`, `passw`, `credential`, `signature` or
 * `session`.
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

/** A scheme word that carries no secret by itself (`Bearer {{token}}`). */
const AUTH_SCHEME = /^\s*(bearer|basic|token|digest)\b/i;

/**
 * Something typed in besides `{{var}}` references and an auth scheme word:
 * `sk_live_x`, `sk_{{env}}_x` and `session=x; tenant={{t}}` are, `{{token}}`
 * and `Bearer {{token}}` are not. A reference holds no secret; text typed
 * next to one may.
 */
export function isLiteralValue(value: string): boolean {
	const rest = value
		.replace(new RegExp(VARIABLE_PATTERN.source, "g"), " ")
		.replace(AUTH_SCHEME, "");
	// Separators alone (`{{user}}:{{pass}}`) are not a secret.
	return rest.replace(/[\s:;,]/g, "") !== "";
}
