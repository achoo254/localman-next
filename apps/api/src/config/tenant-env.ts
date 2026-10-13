import { z } from "zod";

/**
 * Serving claimed domains besides the primary one. Unset: Localman serves
 * only the primary tenant (every Host), as before tenants. Set: other
 * tenants are looked up on the IdP's internal API, on loopback only.
 */
export const tenantEnvShape = {
	/** Origin of the IdP's internal API, e.g. `http://127.0.0.1:4501`. */
	IDP_INTERNAL_URL: z
		.url({ protocol: /^https?$/, error: "must be an http(s) origin" })
		.transform((value) => new URL(value).origin)
		.optional(),
	/** Localman's own secret of that API (its `localman:<secret>` entry). */
	IDP_INTERNAL_SECRET: z
		.string()
		.min(32, "must be at least 32 characters")
		.optional(),
	/**
	 * The IdP's public listener on loopback, e.g. `http://127.0.0.1:4500`:
	 * a tenant's token, userinfo and logout endpoints are called there with
	 * the tenant's Host, never through the tenant's own DNS.
	 */
	IDP_LOOPBACK_URL: z
		.url({ protocol: /^https?$/, error: "must be an http(s) origin" })
		.transform((value) => new URL(value).origin)
		.optional(),
	/**
	 * Key of `localman-web` given by the IdP (`app-client-key.mjs`): the
	 * client secret in a tenant is HMAC-SHA256 of the tenant id under it.
	 */
	LOCALMAN_CLIENT_KEY: z
		.string()
		.regex(/^[A-Za-z0-9_-]{43}$/, "must be the 43-character base64url key")
		.optional(),
};

/** Settings that only make sense together (other tenants are served). */
export const TENANT_ENV_KEYS = [
	"IDP_INTERNAL_URL",
	"IDP_INTERNAL_SECRET",
	"IDP_LOOPBACK_URL",
	"LOCALMAN_CLIENT_KEY",
] as const;

type TenantEnv = {
	readonly [key in (typeof TENANT_ENV_KEYS)[number]]?: string;
};

/** Cross-field rules of the tenant settings. */
export function checkTenantEnv(env: TenantEnv, ctx: z.RefinementCtx): void {
	const set = TENANT_ENV_KEYS.filter((key) => env[key] !== undefined);
	if (set.length > 0 && set.length < TENANT_ENV_KEYS.length) {
		ctx.addIssue({
			code: "custom",
			path: ["IDP_INTERNAL_URL"],
			message: `${TENANT_ENV_KEYS.join(", ")} go together`,
		});
	}
}
