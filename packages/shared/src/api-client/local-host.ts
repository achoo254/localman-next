/**
 * Is the target on the user's own machine or network? Such a target is
 * unreachable from the proxy, so the browser tries it directly and falls
 * back to a Tunelo tunnel. The server still runs its own SSRF guard.
 *
 * Hosts go through the WHATWG URL parser first, which turns every IPv4
 * spelling (`127.1`, `2130706433`, `0x7f000001`, `0177.0.0.1`) into dotted
 * decimal and every IPv6 one into its compressed form.
 */
import { normalizeRequestUrl, parseHttpUrl } from "./url-params.js";

type Ipv4 = [number, number, number, number];

function parseIpv4(host: string): Ipv4 | null {
	const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (!match) return null;
	const [a, b, c, d] = match.slice(1).map(Number);
	const ip: Ipv4 = [a, b, c, d];
	return ip.every((n) => n <= 255) ? ip : null;
}

/** Eight 16-bit groups of a compressed IPv6 address (no brackets). */
function parseIpv6(host: string): number[] | null {
	if (!host.includes(":")) return null;
	const [head = "", tail, extra] = host.split("::");
	if (extra !== undefined) return null;
	const left = head ? head.split(":") : [];
	const right = tail ? tail.split(":") : [];
	const missing = 8 - left.length - right.length;
	if (tail === undefined ? missing !== 0 : missing < 1) return null;
	const groups = [...left, ...Array<string>(missing).fill("0"), ...right];
	if (!groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
	return groups.map((g) => Number.parseInt(g, 16));
}

function isLoopbackIpv4([a]: Ipv4): boolean {
	return a === 127 || a === 0;
}

function isLocalIpv4(ip: Ipv4): boolean {
	const [a, b] = ip;
	return (
		isLoopbackIpv4(ip) ||
		a === 10 ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 169 && b === 254) ||
		(a === 100 && b >= 64 && b <= 127)
	);
}

/** `::ffff:a.b.c.d` as an IPv4 address, otherwise `null`. */
function mappedIpv4(groups: number[]): Ipv4 | null {
	const prefixZero = groups.slice(0, 5).every((g) => g === 0);
	const high = groups[6] ?? 0;
	const low = groups[7] ?? 0;
	if (!prefixZero || groups[5] !== 0xffff) return null;
	return [high >> 8, high & 255, low >> 8, low & 255];
}

function isLoopbackIpv6(groups: number[]): boolean {
	const zeroHead = groups.slice(0, 7).every((g) => g === 0);
	return zeroHead && (groups[7] === 1 || groups[7] === 0);
}

function isLocalIpv6(groups: number[]): boolean {
	const first = groups[0] ?? 0;
	const mapped = mappedIpv4(groups);
	if (mapped) return isLocalIpv4(mapped);
	return (
		isLoopbackIpv6(groups) ||
		(first & 0xfe00) === 0xfc00 || // ULA fc00::/7
		(first & 0xffc0) === 0xfe80 // link-local fe80::/10
	);
}

/** Canonical hostname from a URL (`[::1]` keeps no brackets, no trailing dot). */
function bareHost(url: URL): string {
	return url.hostname
		.replace(/^\[|\]$/g, "")
		.replace(/\.$/, "")
		.toLowerCase();
}

function isLocalBareHost(host: string): boolean {
	if (host === "localhost" || host.endsWith(".localhost")) return true;
	const v4 = parseIpv4(host);
	if (v4) return isLocalIpv4(v4);
	const v6 = parseIpv6(host);
	return v6 ? isLocalIpv6(v6) : false;
}

/** Loopback only: the machine itself, which `tunelo http <port>` exposes. */
function isLoopbackBareHost(host: string): boolean {
	if (host === "localhost") return true;
	const v4 = parseIpv4(host);
	if (v4) return isLoopbackIpv4(v4);
	const v6 = parseIpv6(host);
	if (!v6) return false;
	const mapped = mappedIpv4(v6);
	return mapped ? isLoopbackIpv4(mapped) : isLoopbackIpv6(v6);
}

/**
 * Loopback target: `localhost`, any `*.localhost` (the browser resolves each
 * one to the machine, RFC 6761) and loopback addresses. Such a request is
 * declared with the `loopback` address space; other local targets are `local`.
 */
export function isLoopbackTarget(url: string): boolean {
	const parsed = parseTarget(url);
	if (!parsed) return false;
	const host = bareHost(parsed);
	return host.endsWith(".localhost") || isLoopbackBareHost(host);
}

function parseTarget(url: string): URL | null {
	return parseHttpUrl(normalizeRequestUrl(url));
}

/** `url` (scheme optional) points at localhost, a LAN or a private range. */
export function isLocalTarget(url: string): boolean {
	const parsed = parseTarget(url);
	return parsed ? isLocalBareHost(bareHost(parsed)) : false;
}

/** Same check for a bare host or IP literal (`[::1]` or `::1`). */
export function isLocalHostname(host: string): boolean {
	const bare = host.replace(/^\[|\]$/g, "");
	const literal = bare.includes(":") ? `[${bare}]` : bare;
	return isLocalTarget(`http://${literal}/`);
}

export interface LocalTargetKey {
	/** `localhost:3000`, `192.168.1.5:8080`, `[fd00::1]:80`. */
	key: string;
	port: number;
}

/**
 * Key of a local target for tunnel mappings: every loopback spelling
 * becomes `localhost`, the port defaults to 80/443. `null` when the URL
 * is not local.
 */
export function localTargetKey(url: string): LocalTargetKey | null {
	const parsed = parseTarget(url);
	if (!parsed) return null;
	const host = bareHost(parsed);
	if (!isLocalBareHost(host)) return null;
	const port = Number(parsed.port || (parsed.protocol === "https:" ? 443 : 80));
	const name = isLoopbackBareHost(host)
		? "localhost"
		: host.includes(":")
			? `[${host}]`
			: host;
	return { key: `${name}:${port}`, port };
}
