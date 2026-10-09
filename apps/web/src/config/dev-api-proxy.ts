/**
 * Paths the Vite dev server and the E2E preview forward to the API. Vite
 * matches a key as a plain string prefix, so the API segment ends with "/":
 * "/api" would also capture the SPA route `/api-client`. Production nginx
 * matches `location /api/` the same way.
 */
export const API_PROXY_KEYS = [
	"/api/",
	"/auth",
	"/mcp",
	"/.well-known/oauth-protected-resource",
] as const;

/** Proxy table for Vite: every API key forwards to `target`. */
export function apiProxy(target: string): Record<string, string> {
	return Object.fromEntries(API_PROXY_KEYS.map((key) => [key, target]));
}
