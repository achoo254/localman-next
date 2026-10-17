import { describe, expect, it } from "vitest";
import type { LocalTunnelList } from "./tunelo-view.js";
import { TUNNEL_LIST_TTL_MS, TunnelListCache } from "./tunnel-list-cache.js";

const EMPTY: LocalTunnelList = { tunnels: [], failures: [] };

function deferred() {
	let resolve: (list: LocalTunnelList) => void = () => {};
	const promise = new Promise<LocalTunnelList>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("TunnelListCache", () => {
	it("shares one running fetch per user and keeps its list for the TTL", async () => {
		let now = 1_000;
		const cache = new TunnelListCache(() => now);
		const fetch = deferred();
		let calls = 0;
		const load = () => {
			calls += 1;
			return fetch.promise;
		};
		const first = cache.load("alice", load);
		const second = cache.load("alice", load);
		fetch.resolve(EMPTY);
		expect(await first).toBe(EMPTY);
		expect(await second).toBe(EMPTY);
		expect(calls).toBe(1);
		expect(cache.get("alice")).toBe(EMPTY);
		expect(cache.get("alice", 0)).toBeNull();
		now += TUNNEL_LIST_TTL_MS;
		expect(cache.get("alice")).toBeNull();
	});

	it("discards a load that a drop overtook", async () => {
		const cache = new TunnelListCache(() => 1_000);
		const fetch = deferred();
		const running = cache.load("alice", () => fetch.promise);
		cache.drop("alice");
		fetch.resolve(EMPTY);
		await running;
		expect(cache.get("alice")).toBeNull();
	});
});
