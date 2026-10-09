/**
 * Hand-written routes outside the operation registry. They speak a
 * protocol (OpenID Connect) to browsers or to the IdP instead of offering a
 * business API, so they have no MCP tool. `pnpm check:mcp-coverage` prints
 * this list; protocol-routes.test.ts checks it matches the mounted routes.
 */
export interface ProtocolRoute {
	readonly method: "GET" | "POST";
	readonly path: string;
	readonly summary: string;
	/** Why the route is not an operation with an MCP tool. */
	readonly mcpExempt: string;
}

const OIDC_BROWSER_REDIRECT = "luồng redirect OIDC trên trình duyệt";

export const AUTH_PATHS = {
	login: "/auth/login",
	callback: "/auth/callback",
	logout: "/auth/logout",
	backchannelLogout: "/auth/backchannel-logout",
} as const;

/** Server-to-server endpoints called by the IdP. */
export const INTERNAL_PATHS = {
	auditEvents: "/internal/audit-events",
} as const;

export const PROTOCOL_ROUTES: readonly ProtocolRoute[] = [
	{
		method: "GET",
		path: AUTH_PATHS.login,
		summary: "Redirect to the IdP to sign in (Code + PKCE)",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		method: "GET",
		path: AUTH_PATHS.callback,
		summary: "Redeem the authorization code and open a session",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		method: "POST",
		path: AUTH_PATHS.logout,
		summary: "End the session, then RP-initiated logout at the IdP",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		method: "POST",
		path: AUTH_PATHS.backchannelLogout,
		summary: "Back-channel logout token from the IdP",
		mcpExempt:
			"IdP gọi server-to-server (OIDC Back-Channel Logout), không phải thao tác của user",
	},
	{
		method: "POST",
		path: INTERNAL_PATHS.auditEvents,
		summary: "Credential audit events (signed SETs) pushed by the IdP",
		mcpExempt:
			"IdP đẩy sự kiện audit server-to-server (SET ký ES256 + HTTP Basic), không phải thao tác của user",
	},
];
