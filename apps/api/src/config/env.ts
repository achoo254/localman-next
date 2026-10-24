import { z } from "zod";
import { parseKeyring } from "../modules/auth/token-cipher.js";
import { checkFeatureEnv, featureEnvShape } from "./feature-env.js";
import { mobileEnvShape } from "./mobile-env.js";
import { type TrustProxy, parseTrustProxy } from "./trust-proxy.js";

const port = z.coerce.number().int().min(1).max(65_535);
const httpUrl = (error: string) => z.url({ protocol: /^https?$/, error });

/** Absolute http(s) origin without path, query or fragment. */
const origin = httpUrl("must be an http(s) origin")
	.refine(
		(value) => new URL(value).origin === value.replace(/\/$/, ""),
		"must be an origin without a path",
	)
	.transform((value) => new URL(value).origin);

const envSchema = z
	.object({
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		/**
		 * Interface both servers listen on. Production defaults to loopback
		 * so only nginx on the same host reaches them; unset elsewhere keeps
		 * Node's default (every interface).
		 */
		HOST: z
			.string()
			.regex(
				/^(?:[A-Za-z0-9.-]+|[0-9A-Fa-f:.]+)$/,
				"must be an IP address or a host name",
			)
			.optional(),
		DASHBOARD_PORT: port.default(4000),
		MOCK_PORT: port.default(4100),
		MONGO_URI: z
			.string({ error: "is required" })
			.regex(
				/^mongodb(\+srv)?:\/\/\S+$/,
				"must be a mongodb:// or mongodb+srv:// URI",
			),
		WEB_ORIGIN: origin.default("http://localhost:5173"),
		/** Public origin of the dashboard (redirect URIs, CSRF origin check). */
		PUBLIC_URL: origin.default("http://localhost:5173"),
		LOG_LEVEL: z
			.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
			.default("info"),
		OIDC_ISSUER: httpUrl("is required and must be an http(s) URL"),
		OIDC_CLIENT_ID: z.string().min(1).default("localman-web"),
		OIDC_CLIENT_SECRET: z.string({ error: "is required" }).min(1),
		SESSION_ENCRYPTION_KEY: z
			.string({ error: "is required" })
			.refine(
				(value) => parseKeyring(value) !== null,
				"must be `kid:base64key[,kid:base64key…]` with 32-byte keys",
			),
		/**
		 * Keyring of secret environment and global variables at rest, same
		 * format; without it secret values cannot be saved (503).
		 */
		VARIABLE_ENCRYPTION_KEY: z
			.string()
			.refine(
				(value) => parseKeyring(value) !== null,
				"must be `kid:base64key[,kid:base64key…]` with 32-byte keys",
			)
			.optional(),
		VAPID_PUBLIC_KEY: z.string().min(1).optional(),
		VAPID_PRIVATE_KEY: z.string().min(1).optional(),
		VAPID_SUBJECT: z
			.string()
			.regex(/^(mailto:|https:\/\/)\S+$/, "must be a mailto: or https:// URI")
			.optional(),
		TELEGRAM_BOT_TOKEN: z
			.string()
			.regex(/^\d+:[\w-]+$/, "must look like <id>:<secret>")
			.optional(),
		/**
		 * Express `trust proxy`: which hops may set X-Forwarded-For, so
		 * rate limits see the real client. `false`, a hop count, or names,
		 * IPs and CIDRs (`loopback`, `10.0.0.0/8`), comma separated.
		 */
		TRUST_PROXY: z
			.string()
			.default("loopback")
			.transform((value, ctx): TrustProxy => {
				const parsed = parseTrustProxy(value);
				if (parsed.ok) return parsed.value;
				ctx.addIssue({ code: "custom", message: parsed.message });
				return z.NEVER;
			}),
		/** Basic credentials the IdP uses to push audit events (optional). */
		AUDIT_CLIENT_ID: z
			.string()
			.regex(/^[^:\s]{1,128}$/, "must not contain ':' or spaces")
			.optional(),
		AUDIT_CLIENT_SECRET: z
			.string()
			.min(32, "must be at least 32 characters")
			.optional(),
		TELEGRAM_BOT_USERNAME: z
			.string()
			.regex(/^[A-Za-z0-9_]{5,32}$/, "must be a bot username without @")
			.optional(),
		...featureEnvShape,
		...mobileEnvShape,
	})
	.superRefine((env, ctx) => {
		checkFeatureEnv(env, ctx);
		if (env.DASHBOARD_PORT === env.MOCK_PORT) {
			ctx.addIssue({
				code: "custom",
				path: ["MOCK_PORT"],
				message: "must differ from DASHBOARD_PORT",
			});
		}
		const vapid = [
			env.VAPID_PUBLIC_KEY,
			env.VAPID_PRIVATE_KEY,
			env.VAPID_SUBJECT,
		];
		if (vapid.some(Boolean) && !vapid.every(Boolean)) {
			ctx.addIssue({
				code: "custom",
				path: ["VAPID_PUBLIC_KEY"],
				message:
					"VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT go together",
			});
		}
		if (Boolean(env.AUDIT_CLIENT_ID) !== Boolean(env.AUDIT_CLIENT_SECRET)) {
			ctx.addIssue({
				code: "custom",
				path: ["AUDIT_CLIENT_ID"],
				message: "AUDIT_CLIENT_ID and AUDIT_CLIENT_SECRET go together",
			});
		}
		if (env.NODE_ENV !== "production") return;
		if (typeof env.TRUST_PROXY === "number") {
			ctx.addIssue({
				code: "custom",
				path: ["TRUST_PROXY"],
				message: "must name the proxy addresses in production, not a hop count",
			});
		}
		for (const key of ["PUBLIC_URL", "WEB_ORIGIN", "OIDC_ISSUER"] as const) {
			if (!env[key].startsWith("https://")) {
				ctx.addIssue({
					code: "custom",
					path: [key],
					message: "must use https in production",
				});
			}
		}
	})
	.transform((env) => ({
		...env,
		HOST: env.HOST ?? (env.NODE_ENV === "production" ? "127.0.0.1" : undefined),
	}));

export type Env = z.output<typeof envSchema>;

export class EnvError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "EnvError";
	}
}

/**
 * Validates configuration from the environment. Empty values count as unset
 * so `KEY=` in a .env file falls back to the default. Error messages name the
 * variable but never echo its value, which may be a secret.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
	const defined = Object.fromEntries(
		Object.entries(source).filter(([, value]) => value !== ""),
	);
	const result = envSchema.safeParse(defined);
	if (result.success) return result.data;
	const lines = result.error.issues.map(
		(issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`,
	);
	throw new EnvError(`Invalid environment configuration:\n${lines.join("\n")}`);
}
