import { z } from "zod";

/** Settings of the web console on the apex host (`tunnel.hoandat.com`). */
export interface WebConfig {
	/** OAuth client id at the identity provider (`tunelo-web`). */
	readonly clientId: string;
	readonly clientSecret: string;
	/** Public origin of the console, no trailing slash. */
	readonly publicUrl: string;
	/** 32-byte master key; purpose-specific keys are derived from it. */
	readonly sessionKey: Buffer;
	/** Identity provider issuer (`AUTH_ISSUER`). */
	readonly issuer: string;
}

export type WebConfigResult =
	| { readonly enabled: true; readonly config: WebConfig }
	| {
			readonly enabled: false;
			/** Names of required variables that are unset. Never values. */
			readonly missing: readonly string[];
			/** Names of variables set to something unusable. Never values. */
			readonly invalid: readonly string[];
	  };

const REQUIRED = ["TUNELO_WEB_CLIENT_SECRET", "WEB_SESSION_KEY"] as const;
const KEY_BYTES = 32;

/** An unset or blank variable reads as absent. */
function present(value: string | undefined): string | undefined {
	return value === undefined || value.trim() === "" ? undefined : value.trim();
}

function isAllowedOrigin(value: string): boolean {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return false;
	}
	if (url.origin !== value) return false;
	const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	return url.protocol === "https:" || (local && url.protocol === "http:");
}

const schema = z.object({
	TUNELO_WEB_CLIENT_ID: z.string().regex(/^[\w.-]{1,100}$/),
	TUNELO_WEB_CLIENT_SECRET: z.string().regex(/^\S{16,512}$/),
	TUNELO_WEB_PUBLIC_URL: z
		.string()
		.transform((value) => value.replace(/\/+$/, ""))
		.refine(isAllowedOrigin),
	WEB_SESSION_KEY: z
		.string()
		.regex(/^[A-Za-z0-9_-]{43}=?$/)
		.transform((value) => Buffer.from(value, "base64url"))
		.refine((key) => key.length === KEY_BYTES),
});

export interface WebConfigDefaults {
	readonly issuer: string;
	/** Primary tunnel domain; the public URL defaults to `https://<it>`. */
	readonly primaryDomain: string;
}

/**
 * Reads the web console settings. The console is optional: a missing or bad
 * variable turns it off (reported by name only) while the API and relay run
 * exactly as before.
 */
export function loadWebConfig(
	env: NodeJS.ProcessEnv,
	defaults: WebConfigDefaults,
): WebConfigResult {
	const missing = REQUIRED.filter((name) => present(env[name]) === undefined);
	const parsed = schema.safeParse({
		TUNELO_WEB_CLIENT_ID: present(env.TUNELO_WEB_CLIENT_ID) ?? "tunelo-web",
		TUNELO_WEB_CLIENT_SECRET: present(env.TUNELO_WEB_CLIENT_SECRET) ?? "",
		TUNELO_WEB_PUBLIC_URL:
			present(env.TUNELO_WEB_PUBLIC_URL) ?? `https://${defaults.primaryDomain}`,
		WEB_SESSION_KEY: present(env.WEB_SESSION_KEY) ?? "",
	});
	if (!parsed.success) {
		const failed = new Set(
			parsed.error.issues.map((issue) => String(issue.path[0])),
		);
		const missingSet = new Set<string>(missing);
		return {
			enabled: false,
			missing,
			invalid: [...failed].filter((name) => !missingSet.has(name)).sort(),
		};
	}
	const values = parsed.data;
	return {
		enabled: true,
		config: {
			clientId: values.TUNELO_WEB_CLIENT_ID,
			clientSecret: values.TUNELO_WEB_CLIENT_SECRET,
			publicUrl: values.TUNELO_WEB_PUBLIC_URL,
			sessionKey: values.WEB_SESSION_KEY,
			issuer: defaults.issuer,
		},
	};
}
