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
};

interface TenantEnv {
	readonly IDP_INTERNAL_URL?: string;
	readonly IDP_INTERNAL_SECRET?: string;
}

/** Cross-field rules of the tenant settings. */
export function checkTenantEnv(env: TenantEnv, ctx: z.RefinementCtx): void {
	if (Boolean(env.IDP_INTERNAL_URL) !== Boolean(env.IDP_INTERNAL_SECRET)) {
		ctx.addIssue({
			code: "custom",
			path: ["IDP_INTERNAL_URL"],
			message: "IDP_INTERNAL_URL and IDP_INTERNAL_SECRET go together",
		});
	}
}
