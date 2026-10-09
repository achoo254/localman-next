/**
 * Sending a local target through a Tunelo tunnel: swap `scheme://host:port`
 * for the tunnel's origin and keep path, query and fragment.
 */
import { normalizeRequestUrl, parseHttpUrl } from "./url-params.js";

/** Public tunnels are `https://<subdomain>.tunnel.hoandat.com`. */
export const TUNELO_TUNNEL_DOMAIN = "tunnel.hoandat.com";

/** Same rule as Tunelo's subdomain validation. */
const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * `url` with the tunnel's origin; any path, query or credentials in
 * `tunnelUrl` are ignored (a pasted link often carries a path). `null`
 * when either URL is not http(s).
 */
export function rewriteToTunnel(url: string, tunnelUrl: string): string | null {
	const target = parseHttpUrl(normalizeRequestUrl(url));
	const tunnel = parseHttpUrl(normalizeRequestUrl(tunnelUrl));
	if (!target || !tunnel) return null;
	return `${tunnel.origin}${target.pathname}${target.search}${target.hash}`;
}

/**
 * `url` is a tunnel under one of `domains`: a single valid subdomain label
 * directly below the domain, over https.
 */
export function isTunnelUrl(
	url: string,
	domains: readonly string[] = [TUNELO_TUNNEL_DOMAIN],
): boolean {
	const parsed = parseHttpUrl(url.trim());
	if (!parsed || parsed.protocol !== "https:") return false;
	const host = parsed.hostname.toLowerCase();
	return domains.some((domain) => {
		const suffix = `.${domain.toLowerCase()}`;
		if (!host.endsWith(suffix)) return false;
		return SUBDOMAIN_PATTERN.test(host.slice(0, -suffix.length));
	});
}
