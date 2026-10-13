import { buildTunnelUrl as buildUrlOn } from "@tunelo/shared";

const HOSTNAME_REGEX =
	/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Parses `TUNNEL_DOMAINS` ("tunnel.hoandat.com,tunnel.example.test"). The
 * first entry is the primary domain used in every URL handed out; the rest
 * are still accepted on incoming requests while users move over.
 */
export function parseTunnelDomains(raw: string): string[] {
	const domains = raw
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter((entry) => entry.length > 0);
	if (domains.length === 0) {
		throw new Error("TUNNEL_DOMAINS must list at least one domain");
	}
	for (const domain of domains) {
		if (!HOSTNAME_REGEX.test(domain)) {
			throw new Error(`TUNNEL_DOMAINS has an invalid domain: ${domain}`);
		}
	}
	return [...new Set(domains)];
}

let cached: readonly string[] | null = null;

/**
 * Domains from the environment, read once. `TUNNEL_DOMAIN` (single value) is
 * still honoured so an existing `.env` keeps working until it is migrated.
 */
export function tunnelDomains(): readonly string[] {
	if (cached) return cached;
	const raw = process.env.TUNNEL_DOMAINS ?? process.env.TUNNEL_DOMAIN;
	if (!raw) {
		throw new Error(
			"TUNNEL_DOMAINS env var required (comma-separated, primary first)",
		);
	}
	cached = parseTunnelDomains(raw);
	return cached;
}

export function primaryTunnelDomain(): string {
	const [primary] = tunnelDomains();
	if (!primary) throw new Error("TUNNEL_DOMAINS is empty");
	return primary;
}

/** `https://<subdomain>.<primary domain>` */
export function buildTunnelUrl(subdomain: string): string {
	return buildUrlOn(subdomain, primaryTunnelDomain());
}

/** `tcp://<primary domain>:<port>` */
export function buildTcpUrl(port: number): string {
	return `tcp://${primaryTunnelDomain()}:${port}`;
}
