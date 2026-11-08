import type { HeaderEntry } from "@localman/shared/api-client";
import { isForwardHeader } from "../tunelo/machine-forward-contract.js";
import { staysOnMachine } from "../tunelo/machine-targets.js";
import type { LocalRoute } from "./local-target-route.js";

/**
 * Headers sent on the route. A machine gets the server's link token and
 * port, never the sender's own `tunelo-*` headers or a Host aiming
 * elsewhere.
 */
export function routedHeaders(
	route: LocalRoute,
	headers: readonly HeaderEntry[],
): HeaderEntry[] {
	if (!route.machine) return [...headers];
	return [
		...headers.filter(
			(h) => !isForwardHeader(h.name) && h.name.trim().toLowerCase() !== "host",
		),
		...(route.headers ?? []),
	];
}

/**
 * Which redirects the proxy follows: those filled secrets may go to, and
 * for a machine only back into its forward path; `undefined` for all.
 */
export function followsRedirect(
	route: LocalRoute,
	secretsAllowed: ((to: URL) => boolean) | undefined,
): ((to: URL) => boolean) | undefined {
	if (!(route.machine && route.tunnel)) return secretsAllowed;
	const onMachine = staysOnMachine(route.tunnel);
	return (to) => onMachine(to) && (secretsAllowed?.(to) ?? true);
}
