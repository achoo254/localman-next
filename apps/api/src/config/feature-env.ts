import { z } from "zod";

export const TURNSTILE_VERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** `host[:port]` without scheme, e.g. `localman.hoandat.com`, `localhost:4100`. */
const hostWithPort = z
	.string()
	.trim()
	.toLowerCase()
	.regex(
		/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/,
		"must be a host name with an optional port, without scheme",
	);

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

/**
 * Environment of product features (projects, plans, feedback), kept apart
 * from the platform settings in env.ts.
 */
export const featureEnvShape = {
	/** Mock URLs are `{secret}.{MOCK_BASE_DOMAIN}`; `localhost…` uses http. */
	MOCK_BASE_DOMAIN: hostWithPort.default("localman.hoandat.com"),
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
	if (env.NODE_ENV === "production" && !turnstile.every(Boolean)) {
		ctx.addIssue({
			code: "custom",
			path: ["TURNSTILE_SECRET_KEY"],
			message: "is required in production (public forms need Turnstile)",
		});
	}
}
