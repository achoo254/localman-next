/**
 * First hop of a send, decided before the network: straight from the
 * browser, through the Localman proxy, or through a Tunelo tunnel for a
 * local target. Pure, so every rule is unit tested.
 *
 * Auto mode prefers the direct route (the request never touches a
 * Localman server) unless the browser cannot send it as written: a header
 * `fetch` refuses, "Follow redirects" off, a host pinned to the proxy, or
 * an origin that failed a direct send recently. A local target never goes
 * to the proxy itself (its SSRF guard refuses it): only through a tunnel.
 */
import {
	type HeaderEntry,
	type PreparedRequest,
	type RouteMode,
	forbiddenHeaderNames,
	localTargetKey,
	parseHttpUrl,
} from "@localman/shared/api-client";

export interface RouteTarget {
	/** `scheme://host[:port]`: key of the CORS cache. */
	origin: string;
	/** `host[:port]` as in the URL, lower case. */
	host: string;
	hostname: string;
	/** Set when the target is on the user's machine or network. */
	local: { key: string; port: number } | null;
}

export interface RouteContext {
	mode: RouteMode;
	headers: readonly HeaderEntry[];
	followRedirects: boolean;
	/** Hosts pinned to the proxy (`host[:port]`, lower case). */
	pinnedHosts: ReadonlySet<string>;
	/** The origin failed a direct send recently. */
	corsBlocked: (origin: string) => boolean;
	/** Origin of the enabled tunnel of a local key, if any. */
	tunnelFor: (key: string) => string | null;
}

/** Why a request cannot go straight from the browser in Auto mode. */
export type ProxyReason = "forbidden" | "redirects";

export type RoutePlan =
	/** `strict`: Direct mode, so a failure is shown instead of a fallback. */
	| { hop: "direct"; strict: boolean; forbidden: string[] }
	| {
			hop: "proxy";
			why: "manual" | "pinned" | "remembered" | ProxyReason;
			forbidden: string[];
	  }
	| {
			hop: "tunnel";
			why: "manual" | "remembered" | ProxyReason;
			tunnelUrl: string;
			forbidden: string[];
	  }
	/** Proxy chosen for a local target without a tunnel: show the Tunelo panel. */
	| { hop: "needTunnel" };

/** `null` when `url` is not an absolute http(s) URL. */
export function routeTarget(url: string): RouteTarget | null {
	const parsed = parseHttpUrl(url);
	if (!parsed) return null;
	return {
		origin: parsed.origin,
		host: parsed.host.toLowerCase(),
		hostname: parsed.hostname.toLowerCase(),
		local: localTargetKey(url),
	};
}

function proxyReason(ctx: RouteContext): ProxyReason | null {
	if (forbiddenHeaderNames(ctx.headers).length > 0) return "forbidden";
	return ctx.followRedirects ? null : "redirects";
}

function isPinned(ctx: RouteContext, target: RouteTarget): boolean {
	return (
		ctx.pinnedHosts.has(target.host) || ctx.pinnedHosts.has(target.hostname)
	);
}

export function planRoute(ctx: RouteContext, target: RouteTarget): RoutePlan {
	const forbidden = forbiddenHeaderNames(ctx.headers);
	const reason = proxyReason(ctx);
	if (ctx.mode === "direct") return { hop: "direct", strict: true, forbidden };

	if (target.local) {
		const tunnelUrl = ctx.tunnelFor(target.local.key);
		if (ctx.mode === "proxy") {
			return tunnelUrl
				? { hop: "tunnel", why: "manual", tunnelUrl, forbidden }
				: { hop: "needTunnel" };
		}
		if (tunnelUrl && reason) {
			return { hop: "tunnel", why: reason, tunnelUrl, forbidden };
		}
		if (tunnelUrl && ctx.corsBlocked(target.origin)) {
			return { hop: "tunnel", why: "remembered", tunnelUrl, forbidden };
		}
		return { hop: "direct", strict: false, forbidden };
	}

	if (ctx.mode === "proxy") return { hop: "proxy", why: "manual", forbidden };
	if (isPinned(ctx, target)) return { hop: "proxy", why: "pinned", forbidden };
	if (reason) return { hop: "proxy", why: reason, forbidden };
	if (ctx.corsBlocked(target.origin)) {
		return { hop: "proxy", why: "remembered", forbidden };
	}
	return { hop: "direct", strict: false, forbidden };
}

/** Methods a repeat cannot harm (idempotent per RFC 9110). */
const REPEATABLE_METHODS: ReadonlySet<string> = new Set([
	"GET",
	"HEAD",
	"OPTIONS",
	"PUT",
	"DELETE",
]);

/**
 * A `TypeError` does not prove the target never ran the request: a CORS
 * "simple" POST goes out without a preflight, and a preflighted request
 * may pass the preflight and fail on its answer (an error page without
 * CORS headers). So a request that is not idempotent (POST, PATCH) is not
 * resent on its own, through the proxy or a tunnel: the user decides.
 */
export function mayHaveReachedTarget(prepared: PreparedRequest): boolean {
	return !REPEATABLE_METHODS.has(prepared.method);
}
