import { z } from "zod";
import { parseCidr } from "../modules/api-client/ssrf-guard-ranges.js";

export const TURNSTILE_VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Cloudflare's documented testing secrets (`1x…AA` always passes, `2x…`
 * always fails, `3x…` reports a duplicate). They pass any token, so they
 * are for local testing only.
 */
export const TURNSTILE_TESTING_SECRET = /^[123]x0{31}AA$/;

/** `host[:port]` without scheme, e.g. `localman.hoandat.com`, `localhost:4100`. */
const hostWithPort = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/,
		"must be a host name with an optional port, without scheme",
	);

/** Requests per second allowed by a mock rate limit. */
const perSecond = (fallback: number) =>
	z.coerce.number().int().min(1).max(100_000).default(fallback);

/** Comma-separated IdP subjects; blanks are ignored. */
const subjectList = z
	.string()
	.default("")
	.transform((value) =>
		value
			.split(",")
			.map((sub) => sub.trim())
			.filter((sub) => sub !== ""),
	);

/** Comma-separated IPs or CIDRs (IPv4 or IPv6); blanks are ignored. */
const cidrList = z
	.string()
	.default("")
	.transform((value) =>
		value
			.split(",")
			.map((entry) => entry.trim())
			.filter((entry) => entry !== ""),
	)
	.refine(
		(entries) => entries.every((entry) => parseCidr(entry) !== null),
		"must be comma-separated IP addresses or CIDRs",
	);

/** A DNS name without scheme or port: labels of letters, digits and `-`. */
const DOMAIN_NAME =
	/^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Comma-separated domain names, lowercased; blanks and repeats dropped. */
const domainList = z
	.string()
	.default("")
	.transform((value) => [
		...new Set(
			value
				.split(",")
				.map((entry) => entry.trim().toLowerCase().replace(/\.$/, ""))
				.filter((entry) => entry !== ""),
		),
	])
	.refine(
		(entries) => entries.every((entry) => DOMAIN_NAME.test(entry)),
		"must be comma-separated domain names without scheme or port",
	);

/**
 * Environment of product features (projects, plans, feedback), kept apart
 * from the platform settings in env.ts.
 */
export const featureEnvShape = {
	/** Mock URLs are `{secret}.{MOCK_BASE_DOMAIN}`; `localhost…` uses http. */
	MOCK_BASE_DOMAIN: hostWithPort.default("localman.hoandat.com"),
	/** Mock runtime requests per second per project secret. */
	MOCK_RATE_LIMIT_PER_SECRET: perSecond(60),
	/** Mock runtime requests per second per client IP (IPv6 by /64). */
	MOCK_RATE_LIMIT_PER_IP: perSecond(30),
	/** Mock POST/PUT/PATCH/DELETE per second per project secret. */
	MOCK_WRITE_RATE_LIMIT_PER_SECRET: perSecond(10),
	/** Mock response bytes per second per project secret (20 MiB). */
	MOCK_RESPONSE_BYTES_PER_SECOND: z.coerce
		.number()
		.int()
		.min(64 * 1024)
		.max(1024 * 1024 * 1024)
		.default(20 * 1024 * 1024),
	/** IdP `sub` of the Localman owners (admin pages). */
	OWNER_SUBS: subjectList,
	/** Chat that receives owner alerts (Pro interest) from Localman's bot. */
	OWNER_TELEGRAM_CHAT_ID: z
		.string()
		.regex(/^-?\d{1,20}$/, "must be a numeric Telegram chat id")
		.optional(),
	/** Cloudflare Turnstile on public forms; both keys or none. */
	TURNSTILE_SITE_KEY: z.string().min(1).max(200).optional(),
	TURNSTILE_SECRET_KEY: z.string().min(1).max(200).optional(),
	/**
	 * Addresses the API client proxy must never reach besides the private
	 * ranges and the machine's interface addresses it always refuses: the
	 * server's public IPs when they are not on an interface (NAT).
	 */
	PROXY_BLOCKED_CIDRS: cidrList,
	/**
	 * Tunelo domains: a tunnel is `https://<label>.<domain>`. Only these
	 * URLs can be saved as tunnel mappings, and the proxy may reach them on
	 * the server's own address (Tunelo may share it). Empty: no tunnels.
	 */
	TUNNEL_DOMAINS: domainList,
	/** Siteverify endpoint; tests point it at a local fake. */
	TURNSTILE_VERIFY_URL: z
		.url({ protocol: /^https?$/, error: "must be an http(s) URL" })
		.default(TURNSTILE_VERIFY_URL),
};

interface FeatureEnv {
	readonly NODE_ENV: string;
	readonly TURNSTILE_SITE_KEY?: string;
	readonly TURNSTILE_SECRET_KEY?: string;
}

/** Cross-field rules of the feature settings. */
export function checkFeatureEnv(env: FeatureEnv, ctx: z.RefinementCtx): void {
	const turnstile = [env.TURNSTILE_SITE_KEY, env.TURNSTILE_SECRET_KEY];
	if (turnstile.some(Boolean) && !turnstile.every(Boolean)) {
		ctx.addIssue({
			code: "custom",
			path: ["TURNSTILE_SITE_KEY"],
			message: "TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY go together",
		});
	}
	// Public forms must not accept unverified guests in production.
	if (env.NODE_ENV !== "production") return;
	if (!turnstile.every(Boolean)) {
		ctx.addIssue({
			code: "custom",
			path: ["TURNSTILE_SECRET_KEY"],
			message: "is required in production (public forms need Turnstile)",
		});
	} else if (TURNSTILE_TESTING_SECRET.test(env.TURNSTILE_SECRET_KEY ?? "")) {
		ctx.addIssue({
			code: "custom",
			path: ["TURNSTILE_SECRET_KEY"],
			message: "must not be a Cloudflare testing secret in production",
		});
	}
}
