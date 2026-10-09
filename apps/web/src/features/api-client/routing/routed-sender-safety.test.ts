import { describe, expect, it } from "vitest";
import type { SettledResponse } from "../workbench/workbench-types";
import { draftFor, routerHarness } from "./routed-sender-test-utils";

const TUNNEL = "https://demo.tunnel.hoandat.com";
const TUNNELS = { tunnels: new Map([["localhost:3000", TUNNEL]]) };
const BEARER = { type: "bearer" as const, token: "s3cret" };

function failure(settled: SettledResponse) {
	if (settled.kind !== "failed") throw new Error(`not failed: ${settled.kind}`);
	return settled.failure;
}

/** A POST the browser sends without a preflight (text/plain body). */
function simplePost(url: string) {
	return draftFor(url, {
		method: "POST",
		body: { ...draftFor("").body, type: "raw", rawLanguage: "text", raw: "x" },
	});
}

describe("routed sender never sends twice on its own", () => {
	it("reports a response cut after the target answered, without the proxy", async () => {
		const router = routerHarness({ directOutcome: { kind: "interrupted" } });
		const failed = failure(await router.send(draftFor("https://api.test/a")));
		expect(failed.code).toBe("DIRECT_INTERRUPTED");
		expect(failed.routing).toEqual({
			kind: "direct",
			reason: "interrupted",
			host: "api.test",
			local: false,
		});
		expect(router.proxy).not.toHaveBeenCalled();
		expect(router.cors.size).toBe(0);
	});

	it("does not resend a simple POST to localhost through its tunnel", async () => {
		const router = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: TUNNELS,
		});
		const failed = failure(
			await router.send(simplePost("http://localhost:3000/orders")),
		);
		expect(failed.code).toBe("DIRECT_NOT_RETRIED");
		expect(failed.routing).toMatchObject({ kind: "direct", local: true });
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("does not resend a preflighted PATCH either", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const draft = draftFor("https://api.test/orders/1", { method: "PATCH" });
		expect(failure(await router.send(draft)).code).toBe("DIRECT_NOT_RETRIED");
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("still shows the Tunelo panel for a POST to localhost without a tunnel", async () => {
		const router = routerHarness({ directOutcome: { kind: "blocked" } });
		const failed = failure(
			await router.send(simplePost("http://localhost:3000/orders")),
		);
		expect(failed.code).toBe("TUNNEL_REQUIRED");
		expect(router.proxy).not.toHaveBeenCalled();
	});
});

describe("routed sender asks per host the proxy calls", () => {
	it("asks again for a tunnel even when the local key was allowed", async () => {
		const router = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: { ...TUNNELS, secretHosts: new Set(["localhost:3000"]) },
		});
		await router.send(draftFor("http://localhost:3000/me", { auth: BEARER }));
		expect(router.asks).toEqual([
			expect.objectContaining({
				host: "demo.tunnel.hoandat.com",
				url: TUNNEL,
				target: "localhost:3000",
			}),
		]);
		expect(router.proxy).not.toHaveBeenCalled();
	});

	it("does not ask for a tunnel host allowed before", async () => {
		const router = routerHarness({
			directOutcome: { kind: "blocked" },
			snapshot: {
				...TUNNELS,
				secretHosts: new Set(["demo.tunnel.hoandat.com"]),
			},
		});
		await router.send(draftFor("http://localhost:3000/me", { auth: BEARER }));
		expect(router.asks).toEqual([]);
		expect(router.proxy.mock.calls[0]?.[0].url).toBe(`${TUNNEL}/me`);
	});

	it("asks when Proxy came from the account's default, not from the tab", async () => {
		const router = routerHarness();
		const draft = draftFor("https://api.test/me", { auth: BEARER });
		draft.settings.route = "proxy";
		const declined = failure(await router.send(draft));
		expect(declined.code).toBe("ROUTE_CONSENT_DECLINED");
		expect(router.asks).toEqual([
			expect.objectContaining({ host: "api.test", why: "manual" }),
		]);

		const chosen = routerHarness();
		await chosen.send(draft, undefined, true);
		expect(chosen.asks).toEqual([]);
		expect(chosen.proxy).toHaveBeenCalledOnce();
	});
});
