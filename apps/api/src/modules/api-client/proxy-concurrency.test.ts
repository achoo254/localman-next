import { once } from "node:events";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { UserModel } from "../users/user-model.js";
import { createProxyConcurrency } from "./proxy-concurrency.js";
import {
	PROXY_TEST_ORIGIN,
	PROXY_TEST_USER,
	postProxy,
	proxyTestApp,
} from "./proxy-test-app.js";
import { useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
useDashboardTestDb();

/** Holds `/hang` requests until the test answers them. */
function hangRoute(): {
	readonly hit: Promise<{ req: IncomingMessage; res: ServerResponse }>;
} {
	let hit: (value: { req: IncomingMessage; res: ServerResponse }) => void =
		() => {};
	const promise = new Promise<{ req: IncomingMessage; res: ServerResponse }>(
		(resolve) => {
			hit = resolve;
		},
	);
	server.routes.set("/hang", (req, res) => hit({ req, res }));
	return { hit: promise };
}

describe("proxy concurrency slots", () => {
	it("caps per user and in total, and frees a slot once", () => {
		const slots = createProxyConcurrency({ perUser: 2, total: 3 });
		const a1 = slots.acquire("a");
		const a2 = slots.acquire("a");
		expect(slots.acquire("a")).toEqual({ ok: false, scope: "user" });
		const b1 = slots.acquire("b");
		expect(slots.acquire("c")).toEqual({ ok: false, scope: "server" });
		if (!a1.ok || !a2.ok || !b1.ok) throw new Error("expected slots");
		a1.release();
		a1.release();
		expect(slots.acquire("c").ok).toBe(true);
		expect(slots.acquire("c")).toEqual({ ok: false, scope: "server" });
	});
});

describe("client.sendRequest under the concurrency caps", () => {
	it("answers 429 PROXY_BUSY past a cap, in the user's language", async () => {
		await UserModel.create({ sub: "acc_vi", username: "vi", locale: "vi" });
		const app = proxyTestApp({
			concurrency: createProxyConcurrency({ perUser: 1, total: 2 }),
		});
		const route = hangRoute();
		const url = `${server.origin}/hang`;
		const first = postProxy(app, { method: "GET", url }).then((res) => res);
		const { res: upstream } = await route.hit;

		const mine = await postProxy(app, { method: "GET", url });
		expect(mine.status).toBe(429);
		expect(mine.body.error.code).toBe("PROXY_BUSY");
		expect(mine.body.error.details).toEqual({ scope: "user", max: 1 });

		const second = hangRoute();
		const other = postProxy(app, { method: "GET", url }, "acc_vi").then(
			(res) => res,
		);
		const { res: otherUpstream } = await second.hit;
		const full = await postProxy(app, { method: "GET", url }, "acc_third");
		expect(full.status).toBe(429);
		expect(full.body.error.details).toEqual({ scope: "server", max: 2 });

		const vi = await postProxy(app, { method: "GET", url }, "acc_vi");
		expect(vi.body.error.message).toContain("Bạn đang có 1 request");

		upstream.end("done");
		otherUpstream.end("done");
		expect((await first).status).toBe(200);
		expect((await other).status).toBe(200);
		server.routes.delete("/hang");
		const again = await postProxy(app, { method: "GET", url: server.origin });
		expect(again.status).toBe(200);
	});

	it("stops the upstream request and frees the slot when the caller leaves", async () => {
		const app = proxyTestApp({
			concurrency: createProxyConcurrency({ perUser: 1, total: 4 }),
		});
		const listener = http.createServer(app).listen(0, "127.0.0.1");
		await once(listener, "listening");
		const { port } = listener.address() as AddressInfo;
		try {
			const route = hangRoute();
			const caller = http.request({
				host: "127.0.0.1",
				port,
				path: "/api/v1/proxy",
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: PROXY_TEST_ORIGIN,
					"x-test-sub": PROXY_TEST_USER,
				},
			});
			caller.on("error", () => {});
			caller.end(
				JSON.stringify({ method: "GET", url: `${server.origin}/hang` }),
			);
			const { req: upstream } = await route.hit;
			const upstreamClosed = once(upstream.socket, "close");
			caller.destroy();
			await upstreamClosed;

			server.routes.delete("/hang");
			let res = await postProxy(app, { method: "GET", url: server.origin });
			// The handler's `finally` may run a tick after the socket closed.
			for (let tries = 0; res.status === 429 && tries < 20; tries++) {
				await new Promise((resolve) => setTimeout(resolve, 10));
				res = await postProxy(app, { method: "GET", url: server.origin });
			}
			expect(res.status).toBe(200);
		} finally {
			listener.closeAllConnections();
			listener.close();
		}
	});
});
