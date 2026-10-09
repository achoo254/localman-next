import { BlockList, isIP } from "node:net";

/**
 * Address ranges the proxy never connects to: everything that is not a
 * plain public unicast address. Ranges that embed an IPv4 address in IPv6
 * (mapped, NAT64, 6to4, Teredo) are blocked whole, since the embedded
 * address could be private and the server has no use for them.
 */
const BLOCKED_IPV4: readonly (readonly [string, number])[] = [
	["0.0.0.0", 8], // "this network", 0.0.0.0 reaches the server itself
	["10.0.0.0", 8], // RFC 1918
	["100.64.0.0", 10], // CGNAT (RFC 6598), also Alibaba Cloud metadata
	["127.0.0.0", 8], // loopback
	["169.254.0.0", 16], // link-local, cloud metadata 169.254.169.254
	["172.16.0.0", 12], // RFC 1918
	["192.0.0.0", 24], // IETF protocol assignments
	["192.0.2.0", 24], // TEST-NET-1
	["192.88.99.0", 24], // 6to4 relay anycast
	["192.168.0.0", 16], // RFC 1918
	["198.18.0.0", 15], // benchmarking
	["198.51.100.0", 24], // TEST-NET-2
	["203.0.113.0", 24], // TEST-NET-3
	["224.0.0.0", 4], // multicast
	["240.0.0.0", 4], // reserved, broadcast 255.255.255.255
];

const BLOCKED_IPV6: readonly (readonly [string, number])[] = [
	["::", 96], // unspecified, loopback ::1, IPv4-compatible
	["::ffff:0:0", 96], // IPv4-mapped
	["64:ff9b::", 96], // NAT64 well-known prefix
	["64:ff9b:1::", 48], // NAT64 local-use
	["100::", 64], // discard-only
	["2001::", 23], // IETF special purpose: Teredo, ORCHID, documentation…
	["2001:db8::", 32], // documentation
	["2002::", 16], // 6to4
	["fc00::", 7], // unique local (ULA), AWS metadata fd00:ec2::254
	["fe80::", 10], // link-local
	["fec0::", 10], // site-local (deprecated)
	["ff00::", 8], // multicast
];

export interface Cidr {
	readonly address: string;
	readonly prefix: number;
	readonly family: "ipv4" | "ipv6";
}

/** `a.b.c.d`, `a.b.c.d/nn`, `::1` or `2001:db8::/32`; `null` when invalid. */
export function parseCidr(text: string): Cidr | null {
	const [address = "", prefixText, extra] = text.trim().split("/");
	if (extra !== undefined) return null;
	const version = isIP(address);
	if (version === 0) return null;
	const max = version === 4 ? 32 : 128;
	if (prefixText !== undefined && !/^\d{1,3}$/.test(prefixText)) return null;
	const prefix = prefixText === undefined ? max : Number(prefixText);
	if (prefix > max) return null;
	return { address, prefix, family: version === 4 ? "ipv4" : "ipv6" };
}

/**
 * One `BlockList` per family: Node matches an IPv4 address against IPv6
 * rules through its mapped form, so `::ffff:0:0/96` in a shared list would
 * block every IPv4 address.
 */
export interface AddressBlockList {
	readonly ipv4: BlockList;
	readonly ipv6: BlockList;
}

function emptyLists(): { ipv4: BlockList; ipv6: BlockList } {
	return { ipv4: new BlockList(), ipv6: new BlockList() };
}

/** The ranges every target is checked against, whatever its host name. */
export function builtInBlockList(): AddressBlockList {
	const lists = emptyLists();
	for (const [address, prefix] of BLOCKED_IPV4) {
		lists.ipv4.addSubnet(address, prefix, "ipv4");
	}
	for (const [address, prefix] of BLOCKED_IPV6) {
		lists.ipv6.addSubnet(address, prefix, "ipv6");
	}
	return lists;
}

/**
 * Block lists of IPs or CIDRs (the server's own addresses). Invalid
 * entries throw: the env schema validated them already, and interface
 * addresses come from the OS.
 */
export function blockListOf(cidrs: readonly string[]): AddressBlockList {
	const lists = emptyLists();
	for (const text of cidrs) {
		const cidr = parseCidr(text);
		if (!cidr) throw new Error("Invalid CIDR in the proxy block list");
		lists[cidr.family].addSubnet(cidr.address, cidr.prefix, cidr.family);
	}
	return lists;
}

/**
 * True when `address` is in the lists, or is not an IP at all. With the
 * built-in lists, IPv4-mapped IPv6 is blocked whole whatever IPv4 it
 * carries.
 */
export function isBlockedAddress(
	lists: AddressBlockList,
	address: string,
): boolean {
	const bare = address.split("%")[0] ?? address;
	const version = isIP(bare);
	if (version === 4) return lists.ipv4.check(bare, "ipv4");
	if (version === 6) return lists.ipv6.check(bare, "ipv6");
	return true;
}

/**
 * SMTP ports (25 relay, 465 and 587 submission). Everything else is open:
 * an API may listen anywhere. A proxied body can carry SMTP commands that a
 * lenient mail server would run, which would get the server's address
 * listed as a spam source; no HTTP API lives on these ports.
 */
export const BLOCKED_PORTS: ReadonlySet<number> = new Set([25, 465, 587]);

/** The URL's port, the scheme default when absent. */
export function portOf(url: URL): number {
	if (url.port) return Number(url.port);
	return url.protocol === "https:" ? 443 : 80;
}
