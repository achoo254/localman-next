import { isValidHeaderName } from "@localman/shared/api-client";
import { z } from "zod";
import { localmanDomainOf } from "../../tenancy/idp-tenant-directory.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { normalizeHostname } from "../api-client/ssrf-guard.js";
import type { StoredUpstream } from "../projects/project-model.js";

/**
 * Where a hybrid mock sends what its resources do not answer: nowhere
 * (`none`), the owner's Tunelo tunnel of a local port (`tunnel`), or an
 * https base URL (`url`).
 */
export type ProjectUpstream =
	| { readonly kind: "none" }
	| { readonly kind: "tunnel"; readonly port: number }
	| { readonly kind: "url"; readonly baseUrl: string };

export const NO_UPSTREAM: ProjectUpstream = Object.freeze({ kind: "none" });

/** Longest upstream base URL accepted. */
export const MAX_BASE_URL_LENGTH = 2048;
/** Custom header names masked in the request log, per project. */
export const MAX_REDACT_HEADERS = 50;
const MAX_HEADER_NAME = 100;

export const upstreamSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("none") }),
	z.object({
		kind: z.literal("tunnel"),
		port: z.number().int().min(1).max(65_535),
	}),
	z.object({
		kind: z.literal("url"),
		baseUrl: z.string().min(1).max(MAX_BASE_URL_LENGTH),
	}),
]);

export const redactHeadersSchema = z
	.array(
		z
			.string()
			.min(1)
			.max(MAX_HEADER_NAME)
			.refine(isValidHeaderName, "must be a header name"),
	)
	.max(MAX_REDACT_HEADERS);

/** The stored upstream as the runtime uses it; anything malformed is none. */
export function upstreamOf(
	stored: StoredUpstream | null | undefined,
): ProjectUpstream {
	if (stored?.kind === "tunnel" && typeof stored.port === "number") {
		return { kind: "tunnel", port: stored.port };
	}
	if (stored?.kind === "url" && typeof stored.baseUrl === "string") {
		return { kind: "url", baseUrl: stored.baseUrl };
	}
	return NO_UPSTREAM;
}

/** Lowercase, de-duplicated header names, in the given order. */
export function normalizeRedactHeaders(names: readonly string[]): string[] {
	return [...new Set(names.map((name) => name.trim().toLowerCase()))];
}

/**
 * Whether `hostname` is the mock base domain or one of its project hosts,
 * compared as DNS does (case and trailing dots ignored, see
 * `normalizeHostname`): `abc.{base}.` is a mock host too. Any tenant's
 * `localman.<domain>` and `<x>.localman.<domain>` count as well, so no
 * tenant's mock forwards to another's (or to hoandat's `/m/` fallback).
 */
export function isMockHost(hostname: string): boolean {
	const base = normalizeHostname(
		tenantSettings().mockBaseDomain.split(":")[0] ?? "",
	);
	const host = normalizeHostname(hostname);
	if (localmanDomainOf(host) !== undefined) return true;
	return base !== "" && (host === base || host.endsWith(`.${base}`));
}

/**
 * `https://host[:port][/path]` without trailing slash, or `null` when the
 * URL is not https, carries credentials, a query or a fragment, or points
 * at a Localman mock (a mock forwarding to a mock would loop). The host's
 * addresses are checked separately by the SSRF guard.
 */
export function normalizeBaseUrl(input: string): string | null {
	const value = input.trim();
	if (!URL.canParse(value) || /[?#]/.test(value)) return null;
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.username !== "" ||
		url.password !== "" ||
		url.hostname === "" ||
		isMockHost(url.hostname)
	) {
		return null;
	}
	return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
