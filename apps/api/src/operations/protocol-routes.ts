import { MOCK_MCP_SEGMENT } from "@localman/shared";

/**
 * Hand-written routes outside the operation registry. They speak a
 * protocol (OpenID Connect, OAuth metadata, MCP) to browsers, agents or
 * the IdP instead of offering a business API, so they have no MCP tool of
 * their own. `pnpm check:mcp-coverage` prints this list;
 * protocol-routes.test.ts checks it matches the mounted routes.
 */
export interface ProtocolRoute {
	/** Server that mounts it: dashboard API (:4000) or mock runtime (:4100). */
	readonly server: "dashboard" | "mock";
	/** `ALL`: every method reaches the handler, which refuses the others. */
	readonly methods: readonly ("GET" | "POST" | "OPTIONS" | "ALL")[];
	readonly path: string;
	readonly summary: string;
	/** Why the route is not an operation with an MCP tool. */
	readonly mcpExempt: string;
}

const OIDC_BROWSER_REDIRECT = "luồng redirect OIDC trên trình duyệt";
const MOBILE_SIGN_IN =
	"đăng nhập của app native qua trình duyệt hệ thống (session handoff), không phải thao tác nghiệp vụ";
const APP_ASSOCIATION_EXEMPT =
	"tệp công khai để iOS/Android xác minh app được mở link của host, không phải thao tác của user";
const RESOURCE_METADATA_EXEMPT =
	"tài liệu OAuth Protected Resource Metadata (RFC 9728) công khai để agent tìm IdP trước khi có token, không phải thao tác của user";

export const AUTH_PATHS = {
	login: "/auth/login",
	callback: "/auth/callback",
	logout: "/auth/logout",
	backchannelLogout: "/auth/backchannel-logout",
	/** Native app sign-in (docs/decisions/0005-mobile-session-handoff.md). */
	mobileConfirm: "/auth/mobile/confirm",
	mobileToken: "/auth/mobile/token",
	mobileLogout: "/auth/mobile/logout",
	/** Verified https callback of the app (Universal Links / App Links). */
	mobileCallback: "/m/auth/callback",
} as const;

/** Files that associate the native apps with a dashboard host. */
export const MOBILE_PATHS = {
	appleAssociation: "/.well-known/apple-app-site-association",
	androidAssetLinks: "/.well-known/assetlinks.json",
} as const;

/** Server-to-server endpoints called by the IdP. */
export const INTERNAL_PATHS = {
	auditEvents: "/internal/audit-events",
} as const;

/** Localman MCP and its Protected Resource Metadata (RFC 9728 §3.1). */
export const MCP_PATHS = {
	mcp: "/mcp",
	resourceMetadata: "/.well-known/oauth-protected-resource",
	mcpResourceMetadata: "/.well-known/oauth-protected-resource/mcp",
} as const;

/**
 * Live request log of a project (Server-Sent Events), mounted on the
 * dashboard before the operation router.
 */
export const TRAFFIC_PATHS = {
	logStream: "/api/v1/projects/:projectId/request-logs/stream",
} as const;

/**
 * Hosted Mock MCP, as reached by path; on `{secret}.{MOCK_BASE_DOMAIN}`
 * it is `/{prefix}/mcp`.
 */
export const MOCK_MCP_PATH = `/m/{secret}/{prefix}/${MOCK_MCP_SEGMENT}`;

export const PROTOCOL_ROUTES: readonly ProtocolRoute[] = [
	{
		server: "dashboard",
		methods: ["GET"],
		path: AUTH_PATHS.login,
		summary: "Redirect to the IdP to sign in (Code + PKCE)",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		server: "dashboard",
		methods: ["GET"],
		path: AUTH_PATHS.callback,
		summary: "Redeem the authorization code and open a session",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: AUTH_PATHS.logout,
		summary: "End the session, then RP-initiated logout at the IdP",
		mcpExempt: OIDC_BROWSER_REDIRECT,
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: AUTH_PATHS.backchannelLogout,
		summary: "Back-channel logout token from the IdP",
		mcpExempt:
			"IdP gọi server-to-server (OIDC Back-Channel Logout), không phải thao tác của user",
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: AUTH_PATHS.mobileConfirm,
		summary: "Continue or cancel a native app sign-in (confirmation page)",
		mcpExempt: MOBILE_SIGN_IN,
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: AUTH_PATHS.mobileToken,
		summary: "Redeem a one-time handoff code (PKCE S256) for a mobile session",
		mcpExempt: MOBILE_SIGN_IN,
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: AUTH_PATHS.mobileLogout,
		summary: "End the mobile session of the Bearer token",
		mcpExempt: MOBILE_SIGN_IN,
	},
	{
		server: "dashboard",
		methods: ["GET"],
		path: AUTH_PATHS.mobileCallback,
		summary: "Fallback page of the app callback when no app opened it",
		mcpExempt: MOBILE_SIGN_IN,
	},
	{
		server: "dashboard",
		methods: ["GET"],
		path: MOBILE_PATHS.appleAssociation,
		summary: "Apple App Site Association (applinks, webcredentials)",
		mcpExempt: APP_ASSOCIATION_EXEMPT,
	},
	{
		server: "dashboard",
		methods: ["GET"],
		path: MOBILE_PATHS.androidAssetLinks,
		summary: "Android Digital Asset Links",
		mcpExempt: APP_ASSOCIATION_EXEMPT,
	},
	{
		server: "dashboard",
		methods: ["POST"],
		path: INTERNAL_PATHS.auditEvents,
		summary: "Credential audit events (signed SETs) pushed by the IdP",
		mcpExempt:
			"IdP đẩy sự kiện audit server-to-server (SET ký ES256 + HTTP Basic), không phải thao tác của user",
	},
	{
		server: "dashboard",
		methods: ["ALL"],
		path: MCP_PATHS.mcp,
		summary: "Localman MCP over Streamable HTTP (OAuth 2.1 Bearer)",
		mcpExempt:
			"chính là endpoint MCP: tool của nó là các operation trong registry, không phải một operation",
	},
	{
		server: "dashboard",
		methods: ["GET", "OPTIONS"],
		path: MCP_PATHS.resourceMetadata,
		summary: "Protected Resource Metadata of Localman MCP",
		mcpExempt: RESOURCE_METADATA_EXEMPT,
	},
	{
		server: "dashboard",
		methods: ["GET", "OPTIONS"],
		path: MCP_PATHS.mcpResourceMetadata,
		summary: "Protected Resource Metadata of Localman MCP (path-aware form)",
		mcpExempt: RESOURCE_METADATA_EXEMPT,
	},
	{
		server: "dashboard",
		methods: ["GET"],
		path: TRAFFIC_PATHS.logStream,
		summary: "Live request log of a mock project (Server-Sent Events)",
		mcpExempt:
			"luồng SSE không có một câu trả lời JSON cho REST hay MCP tool; agent đọc log qua tool list_request_logs và get_request_log",
	},
	{
		server: "mock",
		methods: ["ALL"],
		path: MOCK_MCP_PATH,
		summary: "Hosted Mock MCP of one project over Streamable HTTP",
		mcpExempt:
			"chính là endpoint MCP của mock: tool sinh từ resource của project, phục vụ trên mock runtime chứ không phải API dashboard",
	},
];
