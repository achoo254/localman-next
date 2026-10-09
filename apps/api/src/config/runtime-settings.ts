import type { Env } from "./env.js";

export interface TurnstileSettings {
	readonly siteKey: string;
	readonly secretKey: string;
	readonly verifyUrl: string;
	/** Host the widget must have been solved on (from `PUBLIC_URL`). */
	readonly expectedHostname: string;
}

export interface RateLimitWindow {
	readonly max: number;
	readonly windowMs: number;
}

/** Settings that operations read at request time (they are declared statically). */
export interface RuntimeSettings {
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** IdP subjects allowed on admin operations. */
	readonly ownerSubs: ReadonlySet<string>;
	/** `null`: guests are not challenged (development only, see env). */
	readonly turnstile: TurnstileSettings | null;
	/**
	 * Public form submissions per client IP (IPv6 grouped by /64) and,
	 * for signed-in senders, per account: both must pass.
	 */
	readonly feedbackRateLimit: {
		readonly perIp: RateLimitWindow;
		readonly perUser: RateLimitWindow;
	};
	/** Telegram alerts to the owner per kind; the excess is summarized later. */
	readonly ownerAlertLimit: RateLimitWindow;
	/**
	 * Account lookups per owner: invitations and the invite dialog's
	 * lookups share this budget, so looking accounts up by username or
	 * email cannot be used to enumerate them.
	 */
	readonly inviteRateLimit: RateLimitWindow;
	/**
	 * Invite and magic link previews and accepts, per account and per
	 * client IP (IPv6 grouped by /64), so tokens cannot be probed.
	 */
	readonly inviteTokenRateLimit: {
		readonly perUser: RateLimitWindow;
		readonly perIp: RateLimitWindow;
	};
}

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = Object.freeze({
	mockBaseDomain: "localman.hoandat.com",
	ownerSubs: new Set<string>(),
	turnstile: null,
	feedbackRateLimit: {
		perIp: { max: 5, windowMs: 10 * 60_000 },
		perUser: { max: 3, windowMs: 10 * 60_000 },
	},
	ownerAlertLimit: { max: 10, windowMs: 60 * 60_000 },
	inviteRateLimit: { max: 20, windowMs: 60 * 60_000 },
	inviteTokenRateLimit: {
		perUser: { max: 30, windowMs: 10 * 60_000 },
		perIp: { max: 60, windowMs: 10 * 60_000 },
	},
});

let current: RuntimeSettings = DEFAULT_RUNTIME_SETTINGS;

/** Installed by `main.ts` from the environment; tests install their own. */
export function configureRuntime(settings: RuntimeSettings): void {
	current = settings;
}

export function runtimeSettings(): RuntimeSettings {
	return current;
}

export function runtimeSettingsFromEnv(env: Env): RuntimeSettings {
	const { TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY } = env;
	return {
		...DEFAULT_RUNTIME_SETTINGS,
		mockBaseDomain: env.MOCK_BASE_DOMAIN,
		ownerSubs: new Set(env.OWNER_SUBS),
		turnstile:
			TURNSTILE_SITE_KEY && TURNSTILE_SECRET_KEY
				? {
						siteKey: TURNSTILE_SITE_KEY,
						secretKey: TURNSTILE_SECRET_KEY,
						verifyUrl: env.TURNSTILE_VERIFY_URL,
						expectedHostname: new URL(env.PUBLIC_URL).hostname,
					}
				: null,
	};
}
