import { describe, expect, it } from "vitest";
import { useDashboardTestDb } from "../../test-support/dashboard-test-app.js";
import type { LocalRoute } from "./local-target-route.js";
import { postProxy, proxyTestApp } from "./proxy-test-app.js";
import { echoOf, headerValues, useTestServer } from "./proxy-test-server.js";

const server = useTestServer();
useDashboardTestDb();

const TOKEN = "tunelo_link_token_of_the_machine";

/** Stands in for a machine: the test server under the forward path. */
function machineApp(seen: Array<string | undefined> = []) {
	return proxyTestApp({
		routeLocal: async (_sub, _session, url, machine): Promise<LocalRoute> => {
			seen.push(machine);
			const target = new URL(url);
			return {
				url: `${server.origin}/.tunelo/forward${target.pathname}${target.search}`,
				tunnel: server.origin,
				headers: [
					{ name: "Tunelo-Access", value: TOKEN },
					{ name: "Tunelo-Local-Port", value: target.port },
				],
				machine: machine ?? "m-only",
			};
		},
	});
}

describe("client.sendRequest to a machine's localhost", () => {
	it("adds the link token and port, drops the sender's own and its Host", async () => {
		const seen: Array<string | undefined> = [];
		const res = await postProxy(machineApp(seen), {
			method: "GET",
			url: "http://localhost:5173/api?x=1",
			machine: "m1",
			headers: [
				{ name: "Tunelo-Access", value: "forged" },
				{ name: "tunelo-forward-granted", value: "1" },
				{ name: "Host", value: "victim.tunnel.hoandat.com" },
				{ name: "Accept", value: "application/json" },
			],
		});
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(seen).toEqual(["m1"]);
		const echo = echoOf(res.body.body);
		expect(echo.path).toBe("/.tunelo/forward/api?x=1");
		expect(headerValues(echo, "tunelo-access")).toEqual([TOKEN]);
		expect(headerValues(echo, "tunelo-local-port")).toEqual(["5173"]);
		expect(headerValues(echo, "tunelo-forward-granted")).toEqual([]);
		expect(headerValues(echo, "host")).toEqual([new URL(server.origin).host]);
		expect(headerValues(echo, "accept")).toEqual(["application/json"]);
		// The token never comes back in the answer.
		expect(JSON.stringify(res.body.headers)).not.toContain(TOKEN);
	});

	it("keeps the headers on a same-origin redirect, drops them elsewhere", async () => {
		server.routes.set("/.tunelo/forward/same", (_req, res) => {
			res.writeHead(302, { location: "/.tunelo/forward/landed" });
			res.end();
		});
		server.routes.set("/.tunelo/forward/away", (_req, res) => {
			res.writeHead(302, {
				location: `http://echo.test:${server.port}/landed`,
			});
			res.end();
		});
		const app = machineApp();
		const same = await postProxy(app, {
			method: "GET",
			url: "http://localhost:3000/same",
			machine: "m1",
		});
		expect(headerValues(echoOf(same.body.body), "tunelo-access")).toEqual([
			TOKEN,
		]);
		const away = await postProxy(app, {
			method: "GET",
			url: "http://localhost:3000/away",
			machine: "m1",
		});
		expect(away.status, JSON.stringify(away.body)).toBe(200);
		const echo = echoOf(away.body.body);
		expect(away.body.finalUrl).toContain("echo.test");
		expect(headerValues(echo, "tunelo-access")).toEqual([]);
		expect(headerValues(echo, "tunelo-local-port")).toEqual([]);
	});

	it("turns the machine's refusal into an error", async () => {
		server.routes.set("/.tunelo/forward/off", (_req, res) => {
			res.writeHead(403, { "tunelo-forward-error": "TUNELO_FORWARD_003" });
			res.end("{}");
		});
		const res = await postProxy(machineApp(), {
			method: "GET",
			url: "http://localhost:3000/off",
		});
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("MACHINE_FORWARD_DISABLED");
	});
});
