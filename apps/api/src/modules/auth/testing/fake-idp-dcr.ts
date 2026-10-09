import { type Configuration, type Provider, errors } from "oidc-provider";
import {
	DCR_DEFAULT_SCOPES,
	MCP_RESOURCE_SCOPES,
	WEB_CLIENT_ID,
} from "./fake-idp-mcp.js";

/** Authorization endpoint of the fake IdP (set in its `routes`). */
export const AUTHORIZATION_PATH = "/auth";

const OFFLINE_ACCESS = "offline_access";

/** Client metadata the IdP assigns: the resources a client may target. */
const ALLOWED_RESOURCES_PROPERTY = "allowed_resources";

type ExtraClientMetadata = NonNullable<Configuration["extraClientMetadata"]>;
type ProviderMiddleware = Parameters<Provider["use"]>[0];

/**
 * Scope a dynamically registered (MCP) client ends up with, as
 * auth.hoandat.com decides it: `offline_access` is dropped (the MCP SDK
 * adds it when the IdP advertises it; refresh tokens come anyway), any
 * other scope outside the MCP resource is refused, and `credentials:write`
 * is held only when registered by name. No scope: the Localman scopes.
 */
export function dcrScopeOf(requested: unknown): string {
	const scopes =
		typeof requested === "string"
			? requested.split(" ").filter((s) => s !== "" && s !== OFFLINE_ACCESS)
			: [];
	const allowed = new Set(MCP_RESOURCE_SCOPES);
	const refused = scopes.filter((scope) => !allowed.has(scope));
	if (refused.length > 0) {
		throw new errors.InvalidClientMetadata(
			`scope contains values not allowed for dynamically registered clients: ${refused.join(" ")}`,
		);
	}
	return (scopes.length > 0 ? scopes : DCR_DEFAULT_SCOPES).join(" ");
}

/**
 * TEST ONLY. Registration policy of every client but `localman-web`:
 * the scope of `dcrScopeOf` and the MCP resource as the only target. The
 * validator runs on registration and whenever a client is loaded back.
 */
export function dcrClientMetadata(
	localmanPublicUrl: string,
): ExtraClientMetadata {
	return {
		properties: [ALLOWED_RESOURCES_PROPERTY],
		validator: (_ctx, key, _value, metadata) => {
			if (key !== ALLOWED_RESOURCES_PROPERTY) return;
			if (metadata.client_id === WEB_CLIENT_ID) return;
			metadata[ALLOWED_RESOURCES_PROPERTY] = [`${localmanPublicUrl}/mcp`];
			metadata.scope = dcrScopeOf(metadata.scope);
		},
	};
}

/**
 * TEST ONLY. Drops `offline_access` from a DCR client's authorization
 * request, as auth.hoandat.com ignores it: the client was registered
 * without it, so oidc-provider would answer `invalid_scope` (the SDK
 * sends `prompt=consent` with it, which keeps the scope in the request).
 * Agents send the request as a browser redirect, so only GET is handled.
 */
export const ignoreDcrOfflineAccess: ProviderMiddleware = async (ctx, next) => {
	if (ctx.method === "GET" && ctx.path === AUTHORIZATION_PATH) {
		const params = new URLSearchParams(ctx.querystring);
		const requested = params.get("scope")?.split(" ") ?? [];
		if (
			params.get("client_id") !== WEB_CLIENT_ID &&
			requested.includes(OFFLINE_ACCESS)
		) {
			const kept = requested.filter((scope) => scope !== OFFLINE_ACCESS);
			if (kept.length > 0) params.set("scope", kept.join(" "));
			else params.delete("scope");
			ctx.querystring = params.toString();
		}
	}
	await next();
};
