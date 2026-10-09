/**
 * The direct route: `fetch` from the browser. In Auto mode a refused send
 * falls back on its own (proxy, or the local target's tunnel); in Direct
 * mode the failure is shown with the next steps.
 */
import { isLoopbackTarget } from "@localman/shared/api-client";
import { activeTranslator } from "../../../i18n/active-translator";
import { CANCELLED, failed, finishSend } from "../workbench/send-steps";
import type {
	DirectFailReason,
	SettledResponse,
} from "../workbench/workbench-types";
import { directFetch } from "./direct-fetch";
import {
	type HopContext,
	tunnelNeeded,
	viaProxy,
	viaTunnel,
} from "./route-hops";
import { mayHaveReachedTarget } from "./route-plan";

const DIRECT_CODES: Readonly<Record<DirectFailReason, string>> = {
	blocked: "DIRECT_BLOCKED",
	timeout: "DIRECT_TIMEOUT",
	redirect: "DIRECT_REDIRECT",
	interrupted: "DIRECT_INTERRUPTED",
	notRetried: "DIRECT_NOT_RETRIED",
};

function directFailed(
	ctx: HopContext,
	reason: DirectFailReason,
): SettledResponse {
	const host = ctx.target.local?.key ?? ctx.target.host;
	return failed({
		code: DIRECT_CODES[reason],
		message: activeTranslator().t(`apiClientRouting.failure.${reason}`, {
			host,
		}),
		preScript: ctx.ready.preScript,
		routing: { kind: "direct", reason, host, local: ctx.target.local !== null },
	});
}

export async function viaDirect(
	ctx: HopContext,
	strict: boolean,
	forbidden: string[],
): Promise<SettledResponse> {
	const { deps, input, ready, target } = ctx;
	const { settings } = ready.toSend;
	const local = target.local;
	const send = deps.direct ?? directFetch;
	const outcome = await send(ready.prepared, {
		timeoutMs: settings.timeoutMs,
		followRedirects: settings.followRedirects,
		addressSpace: local
			? isLoopbackTarget(target.origin)
				? "loopback"
				: "local"
			: null,
		signal: input.signal,
	});
	switch (outcome.kind) {
		case "cancelled":
			return CANCELLED;
		case "timeout":
		case "redirect":
		case "interrupted":
			return directFailed(ctx, outcome.kind);
		case "response":
			return finishSend(
				input.draft,
				ready,
				{
					response: outcome.response,
					route: "direct",
					routing: {
						why: strict ? "manual" : "direct",
						host: local?.key ?? target.host,
						local: local !== null,
						forbidden,
						dropped: outcome.dropped,
					},
				},
				deps.scripts,
			);
	}
	if (strict) return directFailed(ctx, "blocked");
	// Without a tunnel nothing is resent: the Tunelo panel is a manual step.
	const tunnelUrl = local ? ctx.snapshot.tunnels.get(local.key) : undefined;
	if (local && !tunnelUrl) return tunnelNeeded(ctx, true);
	// Checked before any automatic resend, through a tunnel or the proxy.
	if (mayHaveReachedTarget(ready.prepared)) {
		return directFailed(ctx, "notRetried");
	}
	return tunnelUrl
		? viaTunnel(ctx, tunnelUrl, "cors", forbidden)
		: viaProxy(ctx, "cors", forbidden);
}
