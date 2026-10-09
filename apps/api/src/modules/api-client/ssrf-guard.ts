import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { isTunnelUrl } from "@localman/shared/api-client";
import { dnsFailed, targetBlocked } from "./proxy-errors.js";
import {
	type AddressBlockList,
	BLOCKED_PORTS,
	blockListOf,
	builtInBlockList,
	isBlockedAddress,
	portOf,
} from "./ssrf-guard-ranges.js";

export interface ResolvedAddress {
	readonly address: string;
	readonly family: 4 | 6;
}

/** Every address of a host name (A and AAAA). */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

/** Where one hop connects: checked once, then used as is (no re-resolve). */
export interface PinnedTarget {
	/** Host name without brackets, for SNI and certificate checks. */
	readonly hostname: string;
	readonly address: string;
	readonly family: 4 | 6;
	readonly port: number;
	/** Time the DNS lookup took; `null` for an IP literal. */
	readonly dnsMs: number | null;
	/**
	 * A mock host (`*.{MOCK_BASE_DOMAIN}`) or a Tunelo tunnel host
	 * (`<label>.{TUNNEL_DOMAINS}`): it may sit on the server's own address,
	 * so `Host` must be the URL's host (no user override) and nginx routes
	 * it to the mock runtime or the tunnel server only.
	 */
	readonly forceHost: boolean;
}

export interface SsrfGuard {
	/**
	 * Resolves the URL's host, refuses it when ANY address is blocked (a
	 * name that resolves to one public and one private address is a
	 * rebinding attempt) or the port is a mail port, and pins the first
	 * address. Throws `PROXY_TARGET_BLOCKED` or `PROXY_DNS_FAILED`.
	 */
	pin(url: URL): Promise<PinnedTarget>;
}

export interface SsrfGuardOptions {
	/** Operator CIDRs (`PROXY_BLOCKED_CIDRS`), read at every call. */
	readonly extraBlocked?: () => readonly string[];
	/**
	 * The server's own addresses, read at every call. Defaults to every
	 * address of the machine's network interfaces, so its public IP is
	 * refused without any setting.
	 */
	readonly ownAddresses?: () => readonly string[];
	/** `MOCK_BASE_DOMAIN` (port ignored); its subdomains are mock hosts. */
	readonly mockBaseDomain?: () => string;
	/**
	 * `TUNNEL_DOMAINS`: `https://<label>.<domain>` on port 443, one valid
	 * Tunelo label deep, is a tunnel host. Tunelo may run on this server.
	 */
	readonly tunnelDomains?: () => readonly string[];
	/** Defaults to the system resolver (`dns.lookup`, so `/etc/hosts` counts). */
	readonly resolve?: Resolver;
	/**
	 * TEST ONLY: exact addresses let through although blocked, so tests can
	 * target a server on 127.0.0.1. Only code can pass it; no setting or
	 * environment variable reaches it.
	 */
	readonly allowAddresses?: readonly string[];
}

const systemResolver: Resolver = async (hostname) => {
	const found = await lookup(hostname, { all: true, order: "verbatim" });
	return found.flatMap(({ address, family }) =>
		family === 4 || family === 6 ? [{ address, family }] : [],
	);
};

function bareHostname(url: URL): string {
	return url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

/** Every address on the machine's interfaces, zone ids dropped. */
export function interfaceAddresses(): string[] {
	return Object.values(networkInterfaces()).flatMap((entries) =>
		(entries ?? []).map(({ address }) => address.split("%")[0] ?? address),
	);
}

function isMockHost(hostname: string, mockBaseDomain: string): boolean {
	const base = mockBaseDomain.split(":")[0]?.toLowerCase() ?? "";
	return base !== "" && hostname.toLowerCase().endsWith(`.${base}`);
}

/** nginx serves mock hosts on the scheme's default port only. */
function onDefaultPort(url: URL): boolean {
	return url.port === "";
}

/** nginx serves tunnels over https on 443 only (`:443` parses to ""). */
function isTunnelHost(url: URL, domains: readonly string[]): boolean {
	return (
		domains.length > 0 && url.port === "" && isTunnelUrl(url.href, domains)
	);
}

const NO_EXTRA: readonly string[] = [];
const BUILT_IN = builtInBlockList();

/**
 * SSRF guard of the proxy. Two lists: the built-in ranges (private,
 * loopback, metadata…) hold for every host; the server's own addresses
 * (interfaces plus `PROXY_BLOCKED_CIDRS`) hold for every host except a
 * mock host on its default port and a tunnel host over https on 443:
 * those reach the server's nginx with `Host` forced to the URL's host,
 * i.e. only the mock runtime or the tunnel server.
 */
export function createSsrfGuard(options: SsrfGuardOptions = {}): SsrfGuard {
	const resolve = options.resolve ?? systemResolver;
	const allowed = new Set(options.allowAddresses ?? []);
	let cached: { key: string; list: AddressBlockList } | undefined;

	const ownList = (): AddressBlockList => {
		const own = [
			...(options.ownAddresses ?? interfaceAddresses)(),
			...(options.extraBlocked?.() ?? NO_EXTRA),
		];
		const key = own.join(",");
		if (cached?.key !== key) cached = { key, list: blockListOf(own) };
		return cached.list;
	};
	const blocked = (address: string, ownAllowed: boolean): boolean =>
		!allowed.has(address) &&
		(isBlockedAddress(BUILT_IN, address) ||
			(!ownAllowed && isBlockedAddress(ownList(), address)));

	const addressesOf = async (hostname: string): Promise<ResolvedAddress[]> => {
		try {
			return await resolve(hostname);
		} catch {
			throw dnsFailed(hostname);
		}
	};

	return {
		async pin(url) {
			const port = portOf(url);
			if (BLOCKED_PORTS.has(port)) throw targetBlocked("port");
			const hostname = bareHostname(url);
			const literal = isIP(hostname);
			if (literal !== 0) {
				if (blocked(hostname, false)) throw targetBlocked("address");
				return {
					hostname,
					address: hostname,
					family: literal === 4 ? 4 : 6,
					port,
					dnsMs: null,
					forceHost: false,
				};
			}
			const mockHost = isMockHost(hostname, options.mockBaseDomain?.() ?? "");
			const tunnelHost = isTunnelHost(
				url,
				options.tunnelDomains?.() ?? NO_EXTRA,
			);
			const ownAllowed = (mockHost && onDefaultPort(url)) || tunnelHost;
			const started = performance.now();
			const addresses = await addressesOf(hostname);
			const dnsMs = performance.now() - started;
			const [first] = addresses;
			if (!first) throw dnsFailed(hostname);
			if (addresses.some(({ address }) => blocked(address, ownAllowed))) {
				throw targetBlocked("address");
			}
			const forceHost = mockHost || tunnelHost;
			return { hostname, ...first, port, dnsMs, forceHost };
		},
	};
}
