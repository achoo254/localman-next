import { describe, expect, it } from "vitest";
import {
	autoTunnels,
	failure,
	memoryChoices,
	result,
	tunnel,
} from "./auto-tunnel-test-utils";
import { draftFor, routerHarness } from "./routed-sender-test-utils";

const LOCAL = "http://localhost:3000/users?page=2";

describe("the user's own Tunelo tunnels", () => {
	it("sends through the only HTTP tunnel of the port, path and query kept", async () => {
		const { auto, list } = autoTunnels([[tunnel("api", { basicAuth: true })]]);
		const router = routerHarness({ autoTunnels: auto });
		const sent = result(await router.send(draftFor(LOCAL), { route: "proxy" }));
		expect(list).toHaveBeenCalledWith(3000, false);
		expect(router.proxy.mock.calls[0]?.[0].url).toBe(
			"https://api.tunnel.hoandat.com/users?page=2",
		);
		expect(sent.route).toBe("tunelo");
		expect(sent.routing).toMatchObject({
			tunnelUrl: "https://api.tunnel.hoandat.com",
			tunnelDevice: "api-pc",
			tunnelBasicAuth: true,
		});
	});

	it("falls back to the tunnel after a refused direct send in Auto", async () => {
		const { auto } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({
			autoTunnels: auto,
			directOutcome: { kind: "blocked" },
		});
		const sent = result(await router.send(draftFor(LOCAL)));
		expect(router.direct).toHaveBeenCalledTimes(1);
		expect(sent.routing?.why).toBe("cors");
		expect(sent.route).toBe("tunelo");
	});

	it("does not resend a POST that may have reached the target", async () => {
		const { auto } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({
			autoTunnels: auto,
			directOutcome: { kind: "blocked" },
		});
		const failed = failure(
			await router.send(draftFor(LOCAL, { method: "POST" })),
		);
		expect(failed.routing).toMatchObject({
			kind: "direct",
			reason: "notRetried",
		});
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("never asks Tunelo when an enabled mapping exists", async () => {
		const { auto, list } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({
			autoTunnels: auto,
			snapshot: {
				tunnels: new Map([
					["localhost:3000", "https://mine.tunnel.hoandat.com"],
				]),
			},
		});
		await router.send(draftFor(LOCAL), { route: "proxy" });
		expect(list).not.toHaveBeenCalled();
		expect(router.proxy.mock.calls[0]?.[0].url).toMatch(/^https:\/\/mine\./);
	});

	it("asks once among several tunnels, then remembers the choice", async () => {
		const choices = memoryChoices();
		const second = tunnel("b");
		const { auto, choose } = autoTunnels([[tunnel("a"), second]], {
			pick: second,
			choices,
		});
		const router = routerHarness({ autoTunnels: auto });
		await router.send(draftFor(LOCAL), { route: "proxy" });
		await router.send(draftFor(LOCAL), { route: "proxy" });
		expect(choose).toHaveBeenCalledTimes(1);
		expect(choose.mock.calls[0]).toEqual([
			{ key: "localhost:3000", tunnels: [tunnel("a"), second] },
			expect.any(AbortSignal),
		]);
		expect(choices.get("localhost:3000")).toBe(second.url);
		expect(router.proxy.mock.calls.map(([prepared]) => prepared.url)).toEqual([
			"https://b.tunnel.hoandat.com/users?page=2",
			"https://b.tunnel.hoandat.com/users?page=2",
		]);
	});

	it("sends nothing when the choice is cancelled", async () => {
		const { auto } = autoTunnels([[tunnel("a"), tunnel("b")]], { pick: null });
		const router = routerHarness({ autoTunnels: auto });
		const settled = await router.send(draftFor(LOCAL), { route: "proxy" });
		expect(settled.kind).toBe("cancelled");
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("shows the panel with a TCP notice when the port has TCP tunnels only", async () => {
		const tcp = tunnel("db", {
			protocol: "tcp",
			url: "tcp://tunnel.hoandat.com:40001",
		});
		const { auto } = autoTunnels([[tcp]]);
		const router = routerHarness({ autoTunnels: auto });
		const failed = failure(
			await router.send(draftFor(LOCAL), { route: "proxy" }),
		);
		expect(failed.routing).toEqual({
			kind: "tunnel",
			key: "localhost:3000",
			port: 3000,
			directFailed: false,
			notice: "tcpOnly",
		});
	});

	it("shows the panel, stopped, when the tunnel used before is gone", async () => {
		const choices = memoryChoices({ "localhost:3000": tunnel("api").url });
		const { auto } = autoTunnels([[]], { choices });
		const router = routerHarness({ autoTunnels: auto });
		const failed = failure(
			await router.send(draftFor(LOCAL), { route: "proxy" }),
		);
		expect(failed.routing).toMatchObject({ kind: "tunnel", notice: "stopped" });
	});

	it("shows the plain panel when Tunelo cannot be read, and refreshes on Check again", async () => {
		const { auto, list } = autoTunnels([null]);
		const router = routerHarness({ autoTunnels: auto });
		const failed = failure(
			await router.send(draftFor(LOCAL), {
				route: "proxy",
				refreshTunnels: true,
			}),
		);
		expect(list).toHaveBeenCalledWith(3000, true);
		expect(failed.routing).toEqual({
			kind: "tunnel",
			key: "localhost:3000",
			port: 3000,
			directFailed: false,
		});
	});

	it("tells a stopped tunnel (502 and gone from the list) from the app's own 404", async () => {
		const gone = autoTunnels([[tunnel("api")], []]);
		const stopped = routerHarness({ autoTunnels: gone.auto, proxyStatus: 502 });
		const failed = failure(
			await stopped.send(draftFor(LOCAL), { route: "proxy" }),
		);
		expect(failed.routing).toMatchObject({ kind: "tunnel", notice: "stopped" });
		expect(gone.list).toHaveBeenLastCalledWith(3000, true);

		const alive = autoTunnels([[tunnel("api")]]);
		const app404 = routerHarness({ autoTunnels: alive.auto, proxyStatus: 404 });
		const sent = result(await app404.send(draftFor(LOCAL), { route: "proxy" }));
		expect(sent.response.status).toBe(404);
	});
});
