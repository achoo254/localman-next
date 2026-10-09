import proxyAddr from "proxy-addr";

/** Express `trust proxy`: off, a hop count, or addresses/CIDRs/names. */
export type TrustProxy = false | number | string;

/**
 * Parses TRUST_PROXY with the same `proxy-addr` compiler Express uses, so a
 * value Express would reject (a malformed IP or CIDR such as `1.2.3.4/99`)
 * fails at startup instead of on the first request. `true` (trust every
 * hop, so any client can forge X-Forwarded-For) is never accepted.
 * Returns an error message without echoing the value.
 */
export function parseTrustProxy(
	value: string,
): { ok: true; value: TrustProxy } | { ok: false; message: string } {
	const trimmed = value.trim();
	if (trimmed === "false") return { ok: true, value: false };
	if (trimmed === "true") {
		return {
			ok: false,
			message: "must not be true (anyone could forge X-Forwarded-For)",
		};
	}
	if (/^\d+$/.test(trimmed)) return { ok: true, value: Number(trimmed) };
	const entries = trimmed.split(",").map((entry) => entry.trim());
	try {
		if (entries.some((entry) => entry === "")) throw new TypeError("empty");
		proxyAddr.compile(entries);
	} catch {
		return {
			ok: false,
			message:
				"must be false, a hop count, or comma-separated IPs, CIDRs or loopback/linklocal/uniquelocal",
		};
	}
	return { ok: true, value: entries.join(",") };
}
