import { ROUTE_MODES } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE } from "../../http/require-auth.js";

/** What every client settings operation returns. */
export const settingsView = z.object({
	routingHosts: z.array(z.string()),
	secretProxyHosts: z.array(z.string()),
	tunnelMappings: z.array(
		z.object({ key: z.string(), url: z.string(), enabled: z.boolean() }),
	),
	defaultRoute: z.enum(ROUTE_MODES),
	sendClientIp: z.boolean(),
	tunnelDomains: z.array(z.string()),
});

export const SETTINGS_ABOUT =
	"Routing settings of the API client, own settings only: hosts always sent through the proxy, hosts where credentials may go through the proxy without asking, manual tunnel URLs for local targets (localhost:port, each on or off), the default route and client-IP forwarding of new tabs, and the Tunelo domains a tunnel URL must use (tunnelDomains, set by the server).";

/**
 * Exempt reason of the writes that decide where the browser sends a
 * request's credentials (default route, tunnel URLs, consent hosts): an
 * agent that a prompt injection steers must not redirect them, so these
 * change only from the settings UI.
 */
export const CREDENTIAL_DESTINATION =
	"changes where the browser sends request credentials (proxy route, tunnel URL or consent); only the user changes it, from the UI";

/** Shared fields of the settings writes. */
export const settingsWrite = {
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	output: settingsView,
} as const;
