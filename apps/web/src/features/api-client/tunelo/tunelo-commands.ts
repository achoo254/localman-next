/**
 * Tunelo commands and tunnel URLs as the CLI prints them
 * (`packages/tunelo-cli/README.md`): `npm install -g tunelo`,
 * `tunelo login`, `tunelo http <port>` giving `https://<name>.<domain>`.
 * The domains come from the server (`tunnelDomains` of the client
 * settings), the same list it checks a saved mapping against.
 */
import {
	TUNELO_TUNNEL_DOMAIN,
	isTunnelUrl,
	parseHttpUrl,
} from "@localman/shared/api-client";

export const TUNELO_INSTALL = "npm install -g tunelo";

/**
 * Sign-in for the Tunelo of `tunnelDomain`. The CLI's default server is
 * `TUNELO_TUNNEL_DOMAIN`; any other domain must be named, or the user
 * would sign in at hoandat and open tunnels there.
 */
export function tuneloLoginCommand(tunnelDomain: string | null): string {
	return !tunnelDomain || tunnelDomain === TUNELO_TUNNEL_DOMAIN
		? "tunelo login"
		: `tunelo login --server https://${tunnelDomain}`;
}

export function tuneloHttpCommand(port: number): string {
	return `tunelo http ${port}`;
}

/** Domain shown in examples: the server's first one. */
export function exampleTunnelDomain(domains: readonly string[]): string {
	return domains[0] ?? TUNELO_TUNNEL_DOMAIN;
}

/**
 * Origin of a pasted tunnel URL, or `null` when it is not an https tunnel
 * on one of `domains` (none at all refuses every URL).
 */
export function tunnelOrigin(
	input: string,
	domains: readonly string[],
): string | null {
	const value = input.trim();
	if (domains.length === 0 || !isTunnelUrl(value, domains)) return null;
	return parseHttpUrl(value)?.origin ?? null;
}
