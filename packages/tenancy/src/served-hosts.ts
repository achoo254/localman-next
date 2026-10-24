/**
 * The host name of a `Host` header value: lowercase, without its port
 * (`[::1]:4000` → `::1`, `localman.hoandat.com:443` → `localman.hoandat.com`).
 */
export function hostnameOf(host: string): string {
	const value = host.trim().toLowerCase();
	if (value.startsWith("[")) {
		const end = value.indexOf("]");
		return end > 0 ? value.slice(1, end) : value;
	}
	return value.replace(/:\d*$/, "");
}

/** `localhost`, `*.localhost`, `127.0.0.0/8` and `::1`. */
function isLoopbackHostname(hostname: string): boolean {
	return (
		hostname === "localhost" ||
		hostname.endsWith(".localhost") ||
		hostname === "::1" ||
		/^127(?:\.\d{1,3}){3}$/.test(hostname)
	);
}

/** Which `Host` values an app serves; every other host gets 421. */
export interface ServedHosts {
	/** Hosts served as they are (the dashboard's), compared without port. */
	readonly exact: readonly string[];
	/** Domains served with every subdomain (mock and tunnel domains). */
	readonly withSubdomains: readonly string[];
	/**
	 * Loopback hosts too (`localhost`, `127.x`, `::1`): development and
	 * tests only. Production serves loopback only for its health probe.
	 */
	readonly loopback: boolean;
}

/**
 * Whether `host` (a `Host` header, port allowed) is one of the configured
 * hosts. Anything else, such as another domain or a bare IP address, is
 * refused: links and metadata built from the request's Host (MCP resource
 * URLs) must never name a host the deployment does not own.
 */
export function isServedHost(served: ServedHosts, host: string): boolean {
	const hostname = hostnameOf(host);
	if (hostname === "") return false;
	if (served.loopback && isLoopbackHostname(hostname)) return true;
	if (served.exact.some((entry) => hostnameOf(entry) === hostname)) {
		return true;
	}
	return served.withSubdomains.some((entry) => {
		const domain = hostnameOf(entry);
		return (
			domain !== "" && (hostname === domain || hostname.endsWith(`.${domain}`))
		);
	});
}

/**
 * The domain an app host belongs to: `<label>.<d>` (the app's apex) or
 * `<x>.<label>.<d>` (one label under it), e.g. label `localman` or
 * `tunnel`. Hosts with a port are never matched.
 */
export function appDomainOf(host: string, label: string): string | undefined {
	if (host.includes(":")) return undefined;
	const labels = host.split(".");
	const at = labels[0] === label ? 1 : labels[1] === label ? 2 : -1;
	if (at < 0) return undefined;
	const domain = labels.slice(at);
	return domain.length >= 2 && domain.every(Boolean)
		? domain.join(".")
		: undefined;
}
