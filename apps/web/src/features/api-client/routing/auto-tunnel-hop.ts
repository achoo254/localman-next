/**
 * A local target without an enabled mapping, through one of the user's
 * own Tunelo tunnels (flag `tuneloAccounts`): one HTTP tunnel for the port
 * is used at once, several are asked about once, none shows the Tunelo
 * panel. A tunnel that answers 502/404 and is gone from the list has
 * stopped: the panel says so. Without the flag, the panel as before.
 */
import {
	type AutoTunnelDecision,
	decideAutoTunnel,
} from "../tunelo/auto-tunnel";
import type { LocalTunnel } from "../tunelo/tunelo-accounts-api";
import { CANCELLED } from "../workbench/send-steps";
import type { RouteWhy, SettledResponse } from "../workbench/workbench-types";
import { type HopContext, tunnelNeeded, viaTunnel } from "./route-hops";
import type { AutoTunnels } from "./route-types";

/** What the tunnel answers when Tunelo has no tunnel for it any more. */
const STOPPED_STATUSES: ReadonlySet<number> = new Set([404, 502]);

export interface AutoTunnelOptions {
	/** The browser tried the target directly first and was refused. */
	directFailed: boolean;
	why: RouteWhy;
	forbidden: string[];
	/**
	 * Checked once a tunnel exists, before any is used or asked about: a
	 * response that stops the send there (a POST that may have reached the
	 * target), or `null` to go on.
	 */
	hold?: () => SettledResponse | null;
}

async function listOrNull(
	auto: AutoTunnels,
	port: number,
	refresh: boolean,
): Promise<LocalTunnel[] | null> {
	try {
		return await auto.list(port, refresh);
	} catch {
		return null;
	}
}

function looksStopped(settled: SettledResponse): boolean {
	return (
		settled.kind === "done" &&
		STOPPED_STATUSES.has(settled.result.response.status)
	);
}

export async function viaAutoTunnel(
	ctx: HopContext,
	options: AutoTunnelOptions,
): Promise<SettledResponse> {
	const { directFailed, why, forbidden } = options;
	const auto = ctx.deps.autoTunnels;
	const local = ctx.target.local;
	if (!auto || !local) return tunnelNeeded(ctx, directFailed);
	const { signal } = ctx.input;
	const refresh = ctx.input.options?.refreshTunnels === true;
	const tunnels = await listOrNull(auto, local.port, refresh);
	if (signal.aborted) return CANCELLED;
	const decision: AutoTunnelDecision =
		tunnels === null
			? { kind: "none", stopped: false }
			: decideAutoTunnel(tunnels, auto.choices.get(local.key));
	if (decision.kind === "none") {
		return tunnelNeeded(
			ctx,
			directFailed,
			decision.stopped ? "stopped" : undefined,
		);
	}
	if (decision.kind === "tcpOnly") {
		return tunnelNeeded(ctx, directFailed, "tcpOnly");
	}
	const held = options.hold?.();
	if (held) return held;
	const tunnel =
		decision.kind === "use"
			? decision.tunnel
			: await auto.choose(
					{ key: local.key, tunnels: decision.tunnels },
					signal,
				);
	if (!tunnel || signal.aborted) return CANCELLED;
	auto.choices.set(local.key, tunnel.url);
	const settled = await viaTunnel(ctx, tunnel.url, why, forbidden, {
		deviceName: tunnel.deviceName,
		basicAuth: tunnel.basicAuth,
	});
	if (!looksStopped(settled)) return settled;
	// 404/502 may be the app's own answer: stopped only when it left the list.
	const now = await listOrNull(auto, local.port, true);
	const gone = now !== null && !now.some((item) => item.url === tunnel.url);
	return gone ? tunnelNeeded(ctx, directFailed, "stopped") : settled;
}
