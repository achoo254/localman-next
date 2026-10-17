import { describe, expect, it } from "vitest";
import { autoTunnels, tunnel } from "./auto-tunnel-test-utils";
import { draftFor, routerHarness } from "./routed-sender-test-utils";

const BEARER = { type: "bearer" as const, token: "s3cret" };
const LOCAL = "http://localhost:3000/me";

describe("credentials through a tunnel the router found", () => {
	it("asks first even when Proxy was chosen on the tab", async () => {
		const { auto } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({ autoTunnels: auto });
		const settled = await router.send(
			draftFor(LOCAL, { auth: BEARER }),
			{ route: "proxy" },
			true,
		);
		expect(router.asks).toEqual([
			expect.objectContaining({
				host: "api.tunnel.hoandat.com",
				route: "tunelo",
				parts: ["Authorization"],
			}),
		]);
		// Declined: nothing went through the tunnel.
		expect(settled.kind).toBe("failed");
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("sends once the user agrees", async () => {
		const { auto } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({ autoTunnels: auto, consent: true });
		await router.send(
			draftFor(LOCAL, { auth: BEARER }),
			{ route: "proxy" },
			true,
		);
		expect(router.asks).toHaveLength(1);
		expect(router.proxy).toHaveBeenCalledTimes(1);
	});

	it("keeps a mapped tunnel on a chosen Proxy route as consent", async () => {
		const { auto, list } = autoTunnels([[tunnel("api")]]);
		const router = routerHarness({
			autoTunnels: auto,
			snapshot: {
				tunnels: new Map([
					["localhost:3000", "https://mine.tunnel.hoandat.com"],
				]),
			},
		});
		await router.send(
			draftFor(LOCAL, { auth: BEARER }),
			{ route: "proxy" },
			true,
		);
		expect(router.asks).toEqual([]);
		expect(list).not.toHaveBeenCalled();
		expect(router.proxy).toHaveBeenCalledTimes(1);
	});
});
