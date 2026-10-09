import { describe, expect, it } from "vitest";
import type { SettledResponse } from "../workbench/workbench-types";
import { draftFor, routerHarness } from "./routed-sender-test-utils";

const TUNNEL = "https://demo.tunnel.hoandat.com";
const BEARER = { type: "bearer" as const, token: "s3cret" };

function done(settled: SettledResponse) {
	if (settled.kind !== "done") throw new Error(`not done: ${settled.kind}`);
	return settled.result;
}

function failure(settled: SettledResponse) {
	if (settled.kind !== "failed") throw new Error(`not failed: ${settled.kind}`);
	return settled.failure;
}

describe("routed sender", () => {
	it("sends directly when the target allows it, without touching the proxy", async () => {
		const router = routerHarness();
		const result = done(await router.send(draftFor("https://api.test/users")));
		expect(result.route).toBe("direct");
		expect(result.routing).toMatchObject({ why: "direct", host: "api.test" });
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("falls back to the proxy on a TypeError and remembers the origin", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const result = done(await router.send(draftFor("https://api.test/users")));
		expect(result.route).toBe("proxy");
		expect(result.routing?.why).toBe("cors");
		expect(router.cors).toEqual(new Set(["https://api.test"]));

		router.direct.mockClear();
		const again = done(await router.send(draftFor("https://api.test/other")));
		expect(again.routing?.why).toBe("remembered");
		expect(router.direct).not.toHaveBeenCalled();
	});

	it("does not resend a POST that may have reached the target, nor remember it", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const draft = draftFor("https://api.test/form", {
			method: "POST",
			body: {
				...draftFor("").body,
				type: "raw",
				rawLanguage: "text",
				raw: "x",
			},
		});
		const failed = failure(await router.send(draft));
		expect(failed.code).toBe("DIRECT_NOT_RETRIED");
		expect(router.proxy).not.toHaveBeenCalled();
		// Only an origin the proxy reached goes to the CORS cache.
		expect(router.cors.has("https://api.test")).toBe(false);
	});

	it("remembers the origin when the user sends a blocked POST through the proxy", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const draft = draftFor("https://api.test/form", { method: "POST" });
		const result = done(
			await router.send(draft, { route: "proxy", afterDirectBlocked: true }),
		);
		expect(result.routing?.why).toBe("cors");
		expect(router.cors.has("https://api.test")).toBe(true);
	});

	it("asks before credentials switch to the proxy, and stops when declined", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const failed = failure(
			await router.send(draftFor("https://api.test/me", { auth: BEARER })),
		);
		expect(router.asks).toEqual([
			{
				host: "api.test",
				url: "https://api.test",
				target: "api.test",
				parts: ["Authorization"],
				route: "proxy",
				why: "cors",
			},
		]);
		expect(failed.code).toBe("ROUTE_CONSENT_DECLINED");
		expect(failed.routing).toEqual({
			kind: "consent",
			host: "api.test",
			parts: ["Authorization"],
		});
		expect(router.proxy).not.toHaveBeenCalled();
		// Declined: the origin is not remembered as needing the proxy.
		expect(router.cors.size).toBe(0);
	});

	it("does not ask for a host allowed before, nor when Proxy was chosen", async () => {
		const allowed = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: { secretHosts: new Set(["api.test"]) },
		});
		await allowed.send(draftFor("https://api.test/me", { auth: BEARER }));
		expect(allowed.asks).toEqual([]);
		expect(allowed.proxy).toHaveBeenCalledOnce();

		const manual = routerHarness();
		const draft = draftFor("https://api.test/me", { auth: BEARER });
		const result = done(await manual.send(draft, { route: "proxy" }));
		expect(result.routing?.why).toBe("manual");
		expect(manual.asks).toEqual([]);
		expect(manual.direct).not.toHaveBeenCalled();
	});

	it("shows the failure in Direct mode instead of switching", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const draft = draftFor("https://api.test/");
		draft.settings.route = "direct";
		const failed = failure(await router.send(draft));
		expect(failed.routing).toEqual({
			kind: "direct",
			reason: "blocked",
			host: "api.test",
			local: false,
		});
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("never sends localhost through the proxy without a tunnel", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const failed = failure(
			await router.send(draftFor("http://localhost:3000/a")),
		);
		expect(failed.code).toBe("TUNNEL_REQUIRED");
		expect(failed.routing).toEqual({
			kind: "tunnel",
			key: "localhost:3000",
			port: 3000,
			directFailed: true,
		});
		expect(router.proxy).not.toHaveBeenCalled();
		const draft = draftFor("http://127.0.0.1:3000/a");
		const viaProxy = failure(await router.send(draft, { route: "proxy" }));
		expect(viaProxy.routing).toMatchObject({
			kind: "tunnel",
			directFailed: false,
		});
		expect(router.direct).toHaveBeenCalledOnce();
	});

	it("rewrites a mapped local URL to its tunnel, path and query kept", async () => {
		const router = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: { tunnels: new Map([["localhost:3000", TUNNEL]]) },
		});
		const result = done(
			await router.send(draftFor("http://127.0.0.1:3000/users?page=2#top")),
		);
		expect(router.proxy.mock.calls[0]?.[0].url).toBe(
			`${TUNNEL}/users?page=2#top`,
		);
		expect(result.route).toBe("tunelo");
		expect(result.request.url).toBe(`${TUNNEL}/users?page=2#top`);
		expect(result.routing).toMatchObject({
			why: "cors",
			host: "localhost:3000",
			local: true,
			tunnelUrl: TUNNEL,
		});
	});

	it("asks before credentials go through a tunnel the router picked", async () => {
		const router = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: { tunnels: new Map([["localhost:3000", TUNNEL]]) },
			consent: true,
		});
		const draft = draftFor("http://localhost:3000/me", {
			headers: [{ id: "h", key: "Cookie", value: "sid=1", enabled: true }],
		});
		done(await router.send(draft));
		expect(router.asks).toEqual([
			{
				host: "demo.tunnel.hoandat.com",
				url: TUNNEL,
				target: "localhost:3000",
				parts: ["Cookie"],
				route: "tunelo",
				why: "forbidden",
			},
		]);
		// A header fetch cannot send: the tunnel is used without trying direct.
		expect(router.direct).not.toHaveBeenCalled();
	});
});
