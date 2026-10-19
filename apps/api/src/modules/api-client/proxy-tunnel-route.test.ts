import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import { PROXY_TEST_USER, postProxy, proxyTestApp } from "./proxy-test-app.js";
import { echoOf, useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
useDashboardTestDb();

describe("client.sendRequest through the route of a local target", () => {
	it("sends to the routed URL, not the local one the caller gave", async () => {
		const seen: Array<{ sub: string; session: string | null; url: string }> =
			[];
		// Stands in for the user's tunnel: the test server, under its own path.
		const app = proxyTestApp({
			routeLocal: async (sub, session, url) => {
				seen.push({ sub, session, url });
				return {
					url: `${server.origin}/via-tunnel?page=2`,
					tunnel: server.origin,
				};
			},
		});
		const res = await postProxy(app, {
			method: "POST",
			url: "http://localhost:3000/users?page=2",
			headers: [{ name: "Content-Type", value: "text/plain" }],
			body: "hello",
			bodyType: "text",
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.finalUrl).toBe(`${server.origin}/via-tunnel?page=2`);
		const echo = echoOf(res.body.body);
		expect(echo).toMatchObject({ method: "POST", path: "/via-tunnel?page=2" });
		expect(Buffer.from(echo.bodyBase64, "base64").toString()).toBe("hello");
		expect(seen).toEqual([
			{
				sub: PROXY_TEST_USER,
				session: expect.any(String),
				url: "http://localhost:3000/users?page=2",
			},
		]);
	});
});
