import { runtimeSettings } from "../../config/runtime-settings.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { type SsrfGuard, createSsrfGuard } from "./ssrf-guard.js";

/**
 * The SSRF guard of every outbound request the server makes for a user
 * (API client proxy, mock upstream, replay). It reads
 * `PROXY_BLOCKED_CIDRS`, `MOCK_BASE_DOMAIN` and `TUNNEL_DOMAINS` from the
 * runtime settings at every call and the machine's interface addresses
 * itself.
 */
export function createRuntimeSsrfGuard(): SsrfGuard {
	return createSsrfGuard({
		extraBlocked: () => runtimeSettings().proxyBlockedCidrs,
		mockBaseDomain: () => tenantSettings().mockBaseDomain,
		tunnelDomains: () => tenantSettings().tunnelDomains,
	});
}
