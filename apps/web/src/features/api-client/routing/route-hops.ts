/**
 * Sends through the proxy or a Tunelo tunnel (the proxy calling the
 * tunnel's public URL), each ending in a settled response. Both ask first
 * when the request carries credentials and the user did not pick that
 * route on the tab. The consent is per host the proxy calls: for a tunnel
 * that is the tunnel's host, never the local key. The direct route is in
 * `direct-hop.ts`.
 */
import {
	type PreparedRequest,
	parseHttpUrl,
	rewriteToTunnel,
} from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { proxyHop } from "../workbench/proxy-hop";
import {
	CANCELLED,
	type ReadySend,
	failed,
	finishSend,
} from "../workbench/send-steps";
import type { SendInput } from "../workbench/send-types";
import type {
	RouteWhy,
	SettledResponse,
	TunnelNotice,
} from "../workbench/workbench-types";
import type { RouteTarget } from "./route-plan";
import type { RouterDeps, RoutingSnapshot } from "./route-types";
import { sensitiveParts } from "./sensitive-parts";

export interface HopContext {
	deps: RouterDeps;
	input: SendInput;
	ready: ReadySend;
	target: RouteTarget;
	snapshot: RoutingSnapshot;
	/** The route was set on the tab (or a retry button), not inherited. */
	routeChosen: boolean;
}

/** A tunnel found among the user's own (no mapping): shown with the route. */
export interface FoundTunnel {
	deviceName: string;
	basicAuth: boolean;
}

/** Where the proxy sends the request. */
interface Destination {
	host: string;
	url: string;
}

/** `true` to go on, or the settled "declined"/"cancelled" response. */
async function consent(
	ctx: HopContext,
	{ host, url }: Destination,
	route: "proxy" | "tunelo",
	why: RouteWhy,
	routerFound = false,
): Promise<true | SettledResponse> {
	// Choosing Proxy on the tab is no consent to a tunnel the router found
	// on its own: the user never picked that tunnel or its machine.
	const chosen = why === "manual" && ctx.routeChosen && !routerFound;
	if (chosen || ctx.snapshot.secretHosts.has(host)) return true;
	const parts = sensitiveParts(ctx.ready.toSend, ctx.ready.prepared);
	if (parts.length === 0) return true;
	const { signal } = ctx.input;
	const target = ctx.target.local?.key ?? ctx.target.host;
	const ask = { host, url, target, parts, route, why };
	const ok = await ctx.deps.confirmSecrets(ask, signal);
	if (signal.aborted) return CANCELLED;
	if (ok) return true;
	return failed({
		code: "ROUTE_CONSENT_DECLINED",
		message: activeTranslator().t("apiClientRouting.failure.consent"),
		preScript: ctx.ready.preScript,
		routing: { kind: "consent", host, parts },
	});
}

async function viaProxyHop(
	ctx: HopContext,
	prepared: PreparedRequest,
	route: "proxy" | "tunelo",
	why: RouteWhy,
	forbidden: string[],
	tunnel?: { url: string; found?: FoundTunnel },
): Promise<SettledResponse> {
	const { deps, input, ready, target } = ctx;
	const found = tunnel?.found;
	const send = deps.proxy ?? proxyHop;
	const hop = await send(prepared, ready.toSend.settings, input.signal);
	if (hop.kind === "cancelled") return CANCELLED;
	if (hop.kind === "failed") {
		return failed({ ...hop.failure, preScript: ready.preScript });
	}
	if (why === "cors") deps.corsCache.remember(target.origin);
	return finishSend(
		{ ...ready, prepared },
		{
			response: hop.response,
			route,
			routing: {
				why,
				host: target.local?.key ?? target.host,
				local: target.local !== null,
				forbidden,
				dropped: [],
				...(tunnel ? { tunnelUrl: tunnel.url } : {}),
				...(found
					? { tunnelDevice: found.deviceName, tunnelBasicAuth: found.basicAuth }
					: {}),
			},
		},
		deps.scripts,
	);
}

export async function viaProxy(
	ctx: HopContext,
	why: RouteWhy,
	forbidden: string[],
): Promise<SettledResponse> {
	const { host, origin } = ctx.target;
	const asked = await consent(ctx, { host, url: origin }, "proxy", why);
	if (asked !== true) return asked;
	return viaProxyHop(ctx, ctx.ready.prepared, "proxy", why, forbidden);
}

export async function viaTunnel(
	ctx: HopContext,
	tunnelUrl: string,
	why: RouteWhy,
	forbidden: string[],
	found?: FoundTunnel,
): Promise<SettledResponse> {
	const url = rewriteToTunnel(ctx.ready.prepared.url, tunnelUrl);
	const tunnel = url === null ? null : parseHttpUrl(url);
	if (url === null || tunnel === null) {
		const message = activeTranslator().t("apiClient.send.prepare.invalidUrl");
		return failed({ code: "INVALID_URL", message });
	}
	const destination = {
		host: tunnel.host.toLowerCase(),
		url: tunnel.origin,
	};
	const asked = await consent(
		ctx,
		destination,
		"tunelo",
		why,
		found !== undefined,
	);
	if (asked !== true) return asked;
	const prepared = { ...ctx.ready.prepared, url };
	return viaProxyHop(ctx, prepared, "tunelo", why, forbidden, {
		url: tunnelUrl,
		found,
	});
}

/** A local target with no tunnel: the response area shows the Tunelo panel. */
export function tunnelNeeded(
	ctx: HopContext,
	directFailed: boolean,
	notice?: TunnelNotice,
): SettledResponse {
	const local = ctx.target.local ?? { key: ctx.target.host, port: 80 };
	return failed({
		code: "TUNNEL_REQUIRED",
		message: activeTranslator().t("apiClientRouting.failure.tunnel", {
			key: local.key,
		}),
		preScript: ctx.ready.preScript,
		routing: {
			kind: "tunnel",
			...local,
			directFailed,
			...(notice ? { notice } : {}),
		},
	});
}
