import { type HeaderEntry, hopByHopNames } from "@localman/shared/api-client";

/**
 * Marks a request the mock runtime forwarded to an upstream. A request
 * arriving with it came back from that upstream (directly or through a
 * tunnel), and is not forwarded again.
 */
export const UPSTREAM_HOP_HEADER = "X-Localman-Hop";
/** Says who answered: `mock` or `upstream`. */
export const SOURCE_HEADER = "X-Localman-Source";

const INFRASTRUCTURE = new Set([
	"forwarded",
	"x-real-ip",
	"true-client-ip",
	"cdn-loop",
]);
const INFRASTRUCTURE_PREFIXES = ["x-forwarded-", "cf-", "x-localman-"];

/**
 * Headers that nginx, Cloudflare or Localman itself add on the way in
 * (client address, CDN data, internal markers): neither logged as sent
 * by the client nor forwarded as the client's.
 */
export function isInfrastructureHeader(name: string): boolean {
	const lower = name.trim().toLowerCase();
	return (
		INFRASTRUCTURE.has(lower) ||
		INFRASTRUCTURE_PREFIXES.some((prefix) => lower.startsWith(prefix))
	);
}

/**
 * The client's headers for the upstream: hop-by-hop, infrastructure and
 * `Host` headers dropped (the forwarder sets `Host`, `Content-Length`,
 * `X-Forwarded-For` and `X-Localman-Proxy`), `Cookie` dropped, the hop
 * marker added. A browser sends a mock URL the cookies of Localman (`/m/…`
 * shares the dashboard's origin) and of every `*.hoandat.com` app with a
 * domain cookie; none belongs to the upstream, which cannot set cookies
 * either (`Set-Cookie` is not relayed back).
 */
export function upstreamRequestHeaders(
	clientHeaders: readonly HeaderEntry[],
): HeaderEntry[] {
	const hop = hopByHopNames(clientHeaders);
	const kept: HeaderEntry[] = [];
	for (const { name, value } of clientHeaders) {
		const lower = name.trim().toLowerCase();
		if (
			lower === "host" ||
			lower === "cookie" ||
			hop.has(lower) ||
			isInfrastructureHeader(lower)
		) {
			continue;
		}
		kept.push({ name, value });
	}
	return [...kept, { name: UPSTREAM_HOP_HEADER, value: "1" }];
}
