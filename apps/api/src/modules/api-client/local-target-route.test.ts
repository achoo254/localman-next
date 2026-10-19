import { OperationError } from "@localman/operations";
import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { useTuneloTestEnv } from "../tunelo/testing/tunelo-test-setup.js";
import { httpTunnel } from "../tunelo/testing/tunnel-rows.js";
import { clearTuneloDeps } from "../tunelo/tunelo-runtime.js";
import { routeLocalTarget } from "./local-target-route.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const AGENT = null;
const SESSION = `session-${ALICE}`;
const LOCAL = "http://localhost:3000/users?page=2#top";

/** Links `deviceId` to Alice through the pairing flow. */
async function linkMachine(deviceId: string): Promise<void> {
	const start = await as(ALICE).send("post", "/client/tunnel-links");
	env.tunelo.approve(start.body.code, deviceId);
	await as(ALICE).send("post", `/client/tunnel-links/${start.body.id}/poll`);
}

async function refusal(promise: Promise<unknown>): Promise<OperationError> {
	const error = await promise.then(
		() => null,
		(caught: unknown) => caught,
	);
	if (!(error instanceof OperationError)) throw new Error("expected a refusal");
	return error;
}

describe("routing a local target through the user's tunnel", () => {
	it("leaves a public URL as it is", async () => {
		const route = await routeLocalTarget(
			ALICE,
			AGENT,
			"https://api.example.com/x",
		);
		expect(route).toEqual({ url: "https://api.example.com/x", tunnel: null });
	});

	it("uses the tunnel URL saved for that host and port first", async () => {
		await as(ALICE).send("put", "/client/tunnel-mappings/localhost:3000", {
			url: "https://saved.tunnel.hoandat.com",
		});
		env.tunelo.setDeviceTunnels("pc-1", [httpTunnel("live", 3000)]);
		await linkMachine("pc-1");
		const route = await routeLocalTarget(ALICE, AGENT, LOCAL);
		expect(route).toEqual({
			url: "https://saved.tunnel.hoandat.com/users?page=2#top",
			tunnel: "https://saved.tunnel.hoandat.com",
		});
	});

	it("sends an agent through a linked machine's one tunnel of the port", async () => {
		env.tunelo.setDeviceTunnels("pc-1", [
			httpTunnel("api", 3000),
			httpTunnel("web", 5173),
		]);
		await linkMachine("pc-1");
		const route = await routeLocalTarget(
			ALICE,
			AGENT,
			"http://127.0.0.1:3000/a",
		);
		expect(route.url).toBe("https://api.tunnel.hoandat.com/a");
	});

	it("never reads the account's tunnels without a browser session", async () => {
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("mine", 3000)]);
		const agent = await refusal(routeLocalTarget(ALICE, AGENT, LOCAL));
		expect(agent.code).toBe("PROXY_TARGET_BLOCKED");
		expect(agent.message).toContain("tunelo http 3000");
		const browser = await routeLocalTarget(ALICE, SESSION, LOCAL);
		expect(browser.url).toBe(
			"https://mine.tunnel.hoandat.com/users?page=2#top",
		);
	});

	it("asks to choose when several tunnels serve the port", async () => {
		env.tunelo.setDeviceTunnels("pc-1", [httpTunnel("one", 3000)]);
		env.tunelo.setDeviceTunnels("pc-2", [httpTunnel("two", 3000)]);
		await linkMachine("pc-1");
		await linkMachine("pc-2");
		const error = await refusal(routeLocalTarget(ALICE, AGENT, LOCAL));
		expect(error.status).toBe(409);
		expect(error.code).toBe("PROXY_TUNNEL_AMBIGUOUS");
		expect(error.message).toContain("https://one.tunnel.hoandat.com");
		expect(error.message).toContain("https://two.tunnel.hoandat.com");
	});

	it("refuses a LAN address without a saved tunnel", async () => {
		env.tunelo.setDeviceTunnels("pc-1", [httpTunnel("api", 8080)]);
		await linkMachine("pc-1");
		const error = await refusal(
			routeLocalTarget(ALICE, AGENT, "http://192.168.1.5:8080/"),
		);
		expect(error.code).toBe("PROXY_TARGET_BLOCKED");
	});

	it("skips TCP tunnels, which cannot carry HTTP", async () => {
		env.tunelo.setDeviceTunnels("pc-1", [
			{
				...httpTunnel("db", 3000),
				subdomain: null,
				protocol: "tcp",
				url: "tcp://tunnel.hoandat.com:40001",
				publicPort: 40001,
			},
			httpTunnel("api", 3000),
		]);
		await linkMachine("pc-1");
		const route = await routeLocalTarget(ALICE, AGENT, LOCAL);
		expect(route.url).toBe("https://api.tunnel.hoandat.com/users?page=2#top");
	});

	it("tells the agent and the browser the ways that reach them", async () => {
		const agent = await refusal(routeLocalTarget(ALICE, AGENT, LOCAL));
		expect(agent.message).toContain("linked with `tunelo link`");
		expect(agent.message).not.toContain("tunelo login");
		const browser = await refusal(routeLocalTarget(ALICE, SESSION, LOCAL));
		expect(browser.message).toContain("tunelo login");
	});

	it("says Tunelo did not answer instead of 'no tunnel'", async () => {
		env.failExchange.add(ALICE);
		const error = await refusal(routeLocalTarget(ALICE, SESSION, LOCAL));
		expect(error.status).toBe(502);
		expect(error.code).toBe("PROXY_TUNNEL_UNAVAILABLE");
	});

	it("uses saved tunnel URLs only while Tunelo is off", async () => {
		env.tunelo.setDeviceTunnels("pc-1", [httpTunnel("api", 3000)]);
		await linkMachine("pc-1");
		await as(ALICE).send("put", "/client/tunnel-mappings/localhost:5173", {
			url: "https://saved.tunnel.hoandat.com",
		});
		clearTuneloDeps();
		const refused = await refusal(routeLocalTarget(ALICE, SESSION, LOCAL));
		expect(refused.code).toBe("PROXY_TARGET_BLOCKED");
		const saved = await routeLocalTarget(
			ALICE,
			AGENT,
			"http://localhost:5173/",
		);
		expect(saved.url).toBe("https://saved.tunnel.hoandat.com/");
	});

	it("refuses through the proxy with the way to open a tunnel", async () => {
		const res = await as(ALICE).send("post", "/proxy", {
			method: "GET",
			url: "http://localhost:4999/",
		});
		expect(res.status).toBe(403);
		expect(res.body.error).toMatchObject({
			code: "PROXY_TARGET_BLOCKED",
			details: { local: "localhost:4999" },
		});
		// Counted like any refused target (probing is not free).
		const usage = await as(ALICE).get("/account/usage");
		expect(usage.body.proxyRequests.used).toBe(1);
	});
});
