/**
 * Localman's side of Tunelo's local forward (`LOCAL_FORWARD` in
 * packages/tunelo-shared/src/constants.ts; Localman does not import Tunelo
 * packages, ADR tunelo/0005): a request for `localhost:<port>` on a linked
 * machine goes to `<forwardUrl>/<path>` with the machine's link token.
 */

/** Path under the machine tunnel, as `forwardUrl` ends. */
export const FORWARD_PATH = "/.tunelo/forward";

/** Headers of a forward. Only the server sets them; users cannot. */
export const FORWARD_HEADERS = {
	access: "Tunelo-Access",
	localPort: "Tunelo-Local-Port",
} as const;

/** Every `tunelo-*` header a sender may not set or forward. */
export function isForwardHeader(name: string): boolean {
	return name.trim().toLowerCase().startsWith("tunelo-");
}

/** Response header naming why a forward was refused. */
export const FORWARD_ERROR_HEADER = "tunelo-forward-error";

/** `FORWARD_ERROR_HEADER` values. */
export const FORWARD_ERRORS = {
	notFound: "TUNELO_FORWARD_001",
	portBlocked: "TUNELO_FORWARD_002",
	disabled: "TUNELO_FORWARD_003",
	badPort: "TUNELO_FORWARD_004",
	portClosed: "TUNELO_FORWARD_005",
	offline: "TUNELO_TUNNEL_002",
} as const;

/** Ports Tunelo never forwards (the machine adds its own). */
export const DENIED_PORTS: ReadonlySet<number> = new Set([
	2375, 2376, 5005, 9222, 9229, 63342,
]);
