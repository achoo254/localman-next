/**
 * The workbench's sender: scripts and `{{var}}` first, then the route
 * (`route-plan.ts`) picks direct, proxy or Tunelo, then the post-response
 * script. Never rejects, like every `RequestSender`.
 */
import { forbiddenHeaderNames } from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { failed, prepareSend } from "../workbench/send-steps";
import type { RequestSender } from "../workbench/send-types";
import { viaAutoTunnel } from "./auto-tunnel-hop";
import { viaDirect } from "./direct-hop";
import { type HopContext, viaProxy, viaTunnel } from "./route-hops";
import { planRoute, routeTarget } from "./route-plan";
import { EMPTY_SNAPSHOT, type RouterDeps } from "./route-types";

export function createRoutedSender(deps: RouterDeps): RequestSender {
	return async (input) => {
		const ready = await prepareSend(input, deps.scripts);
		if (!ready.ok) return ready.settled;
		const target = routeTarget(ready.prepared.url);
		if (!target) {
			const message = activeTranslator().t("apiClient.send.prepare.invalidUrl");
			return failed({
				code: "INVALID_URL",
				message,
				preScript: ready.preScript,
			});
		}
		// Settings that cannot be read leave the defaults: nothing pinned,
		// no tunnel, ask before credentials go through the proxy.
		const snapshot = await deps.snapshot().catch(() => EMPTY_SNAPSHOT);
		const { settings } = ready.toSend;
		const plan = planRoute(
			{
				mode: input.options?.route ?? settings.route,
				headers: ready.prepared.headers,
				followRedirects: settings.followRedirects,
				pinnedHosts: snapshot.pinnedHosts,
				corsBlocked: deps.corsCache.has,
				tunnelFor: (key) => snapshot.tunnels.get(key) ?? null,
			},
			target,
		);
		const routeChosen =
			input.options?.route !== undefined || input.routeChosen === true;
		const ctx: HopContext = {
			deps,
			input,
			ready,
			target,
			snapshot,
			routeChosen,
		};
		switch (plan.hop) {
			case "direct":
				return viaDirect(ctx, plan.strict, plan.forbidden);
			case "proxy":
				return viaProxy(
					ctx,
					input.options?.afterDirectBlocked ? "cors" : plan.why,
					plan.forbidden,
				);
			case "tunnel":
				return viaTunnel(ctx, plan.tunnelUrl, plan.why, plan.forbidden);
			case "needTunnel":
				return viaAutoTunnel(ctx, {
					directFailed: false,
					why: "manual",
					forbidden: forbiddenHeaderNames(ready.prepared.headers),
				});
		}
	};
}
