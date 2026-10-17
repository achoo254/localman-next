/** TEST ONLY. The user's own tunnels, faked for the router tests. */
import { vi } from "vitest";
import type { TunnelChoices } from "../tunelo/auto-tunnel";
import type { LocalTunnel } from "../tunelo/tunelo-accounts-api";
import type { SettledResponse } from "../workbench/workbench-types";
import type { AutoTunnels } from "./route-types";

export function tunnel(
	name: string,
	overrides: Partial<LocalTunnel> = {},
): LocalTunnel {
	return {
		protocol: "http",
		url: `https://${name}.tunnel.hoandat.com`,
		localPort: 3000,
		deviceName: `${name}-pc`,
		basicAuth: false,
		...overrides,
	};
}

export function memoryChoices(
	initial: Record<string, string> = {},
): TunnelChoices {
	const store = new Map(Object.entries(initial));
	return {
		get: (key) => store.get(key) ?? null,
		set: (key, url) => {
			store.set(key, url);
		},
	};
}

/** Auto tunnels answering `lists` in turn (the last one repeats). */
export function autoTunnels(
	lists: (LocalTunnel[] | null)[],
	options: { pick?: LocalTunnel | null; choices?: TunnelChoices } = {},
) {
	let call = 0;
	const list = vi.fn(async (_port: number, _refresh: boolean) => {
		const answer = lists[Math.min(call, lists.length - 1)] ?? null;
		call += 1;
		return answer;
	});
	const choose = vi.fn(async () => options.pick ?? null);
	const auto: AutoTunnels = {
		list,
		choose,
		choices: options.choices ?? memoryChoices(),
	};
	return { auto, list, choose };
}

export function failure(settled: SettledResponse) {
	if (settled.kind !== "failed")
		throw new Error(`expected failed, got ${settled.kind}`);
	return settled.failure;
}

export function result(settled: SettledResponse) {
	if (settled.kind !== "done")
		throw new Error(`expected done, got ${settled.kind}`);
	return settled.result;
}
