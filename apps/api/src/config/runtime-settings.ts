import { type Keyring, parseKeyring } from "../modules/auth/token-cipher.js";
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

/** Dashboard operations that load the shared process (see `heavyOperationRateLimit`). */
export type HeavyOperation =
	| "generate"
	| "replaceData"
	| "reset"
	| "clone"
	| "import"
	| "suggestFaker";

/** Settings that operations read at request time (they are declared statically). */
export interface RuntimeSettings {
	/** Mock URLs are `{secret}.{mockBaseDomain}`. */
	readonly mockBaseDomain: string;
	/** Origin of the web app (`PUBLIC_URL`), for links into the UI. */
	readonly publicUrl: string;
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
	/**
	 * Localman MCP requests (`/mcp`) per IdP subject, every JSON-RPC
	 * message counted (tool calls, lists, subscriptions): 429 with
	 * `Retry-After` past it. Far above what an agent sends while working.
	 */
	readonly localmanMcpRateLimit: RateLimitWindow;
	/**
	 * API client proxy (`client.sendRequest`, MCP `send_request`) calls
	 * per account, on top of the plan's monthly `proxyRequestsPerMonth`.
	 */
	readonly proxyRateLimit: RateLimitWindow;
	/**
	 * CIDRs the proxy never connects to, on top of the private, loopback
	 * and metadata ranges and the interface addresses it always refuses:
	 * public addresses of the server not on an interface
	 * (`PROXY_BLOCKED_CIDRS`).
	 */
	readonly proxyBlockedCidrs: readonly string[];
	/**
	 * Tunelo domains (`TUNNEL_DOMAINS`): the only hosts a tunnel mapping
	 * may use, and the only ones besides mock hosts that the proxy may
	 * reach on the server's own address.
	 */
	readonly tunnelDomains: readonly string[];
	/** Keys of secret variables at rest; `null`: they cannot be saved. */
	readonly variableKeyring: Keyring | null;
	/**
	 * Public sharing. Per client IP before any lookup, so guessing link
	 * ids or keys writes one counter per address, never one per guess;
	 * per key only once a key matched; per account for signed-in pages.
	 */
	readonly publicSharingRateLimit: {
		readonly publicLinkPerIp: RateLimitWindow;
		readonly signedInPerUser: RateLimitWindow;
		readonly accessKeyPerIp: RateLimitWindow;
		readonly accessKeyPerKey: RateLimitWindow;
	};
	/**
	 * Heavy dashboard operations per account and per project, both must
	 * pass: they render, write and measure megabytes in the process that
	 * also serves every mock API. Far above what a person clicks.
	 */
	readonly heavyOperationRateLimit: Readonly<
		Record<
			HeavyOperation,
			{
				readonly perUser: RateLimitWindow;
				/** Absent for an operation outside any project. */
				readonly perProject?: RateLimitWindow;
			}
		>
	>;
}

const perMinute = (max: number): RateLimitWindow => ({ max, windowMs: 60_000 });

export const DEFAULT_RUNTIME_SETTINGS: RuntimeSettings = Object.freeze({
	mockBaseDomain: "localman.hoandat.com",
	publicUrl: "http://localhost:5173",
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
	localmanMcpRateLimit: perMinute(120),
	proxyRateLimit: perMinute(120),
	proxyBlockedCidrs: [],
	tunnelDomains: [],
	variableKeyring: null,
	publicSharingRateLimit: {
		publicLinkPerIp: perMinute(60),
		signedInPerUser: perMinute(60),
		accessKeyPerIp: perMinute(60),
		accessKeyPerKey: perMinute(60),
	},
	heavyOperationRateLimit: {
		generate: { perUser: perMinute(30), perProject: perMinute(60) },
		replaceData: { perUser: perMinute(60), perProject: perMinute(120) },
		reset: { perUser: perMinute(30), perProject: perMinute(60) },
		clone: { perUser: perMinute(10), perProject: perMinute(20) },
		// Previews too: each one parses up to 2 MB of source.
		import: { perUser: perMinute(60), perProject: perMinute(120) },
		suggestFaker: { perUser: perMinute(120) },
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
		publicUrl: env.PUBLIC_URL,
		ownerSubs: new Set(env.OWNER_SUBS),
		proxyBlockedCidrs: env.PROXY_BLOCKED_CIDRS,
		tunnelDomains: env.TUNNEL_DOMAINS,
		variableKeyring: env.VARIABLE_ENCRYPTION_KEY
			? parseKeyring(env.VARIABLE_ENCRYPTION_KEY)
			: null,
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
