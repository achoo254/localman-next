import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import { httpTunnel } from "./testing/tunnel-rows.js";
import { setTuneloDeps } from "./tunelo-runtime.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

/** Links `deviceId` to `sub` through the pairing flow; answers the link id. */
async function linkMachine(sub: string, deviceId: string): Promise<string> {
	const start = await as(sub).send("post", "/client/tunnel-links");
	env.tunelo.approve(start.body.code, deviceId);
	await as(sub).send("post", `/client/tunnel-links/${start.body.id}/poll`);
	return start.body.id;
}

describe("client.listLocalTunnels", () => {
	it("merges the account's tunnels with each linked machine's, by port", async () => {
		env.tunelo.setAccountTunnels(ALICE, [
			httpTunnel("api", 3000, { basicAuth: true }),
			{
				...httpTunnel("db", 5432),
				subdomain: null,
				protocol: "tcp",
				url: "tcp://tunnel.hoandat.com:40001",
				publicPort: 40001,
			},
		]);
		env.tunelo.setDeviceTunnels("pc-2", [
			httpTunnel("other", 3000, { deviceName: "office-pc" }),
		]);
		const linkId = await linkMachine(ALICE, "pc-2");

		const all = await as(ALICE).get("/client/local-tunnels");
		expect(all.status).toBe(200);
		expect(all.body.failures).toEqual([]);
		expect(all.body.tunnels).toHaveLength(3);

		const port = await as(ALICE).get("/client/local-tunnels?port=3000");
		expect(port.body.tunnels).toEqual([
			{
				source: "account",
				linkId: null,
				protocol: "http",
				url: "https://api.tunnel.hoandat.com",
				localPort: 3000,
				publicPort: null,
				deviceName: "dev-laptop",
				connectedAt: "2026-10-17T08:00:00.000Z",
				basicAuth: true,
			},
			expect.objectContaining({
				source: "link",
				linkId,
				url: "https://other.tunnel.hoandat.com",
				deviceName: "office-pc",
			}),
		]);
		// The machine's name is learnt for the linked machines list.
		const links = await as(ALICE).get("/client/tunnel-links");
		expect(links.body.links[0].deviceName).toBe("office-pc");
	});

	it("shows each user their own tunnels only", async () => {
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("alice", 3000)]);
		env.tunelo.setDeviceTunnels("pc-a", [httpTunnel("alice-pc", 3000)]);
		await linkMachine(ALICE, "pc-a");
		const bob = await as(BOB).get("/client/local-tunnels?port=3000");
		expect(bob.body).toEqual({ tunnels: [], failures: [] });
		const alice = await as(ALICE).get("/client/local-tunnels?port=3000");
		expect(alice.body.tunnels).toHaveLength(2);
	});

	it("reuses the list for 10 seconds unless asked to refresh", async () => {
		const first = await as(ALICE).get("/client/local-tunnels?port=3000");
		expect(first.body.tunnels).toEqual([]);
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("api", 3000)]);
		const cached = await as(ALICE).get("/client/local-tunnels?port=3000");
		expect(cached.body.tunnels).toEqual([]);
		const fresh = await as(ALICE).get(
			"/client/local-tunnels?port=3000&refresh=true",
		);
		expect(fresh.body.tunnels).toHaveLength(1);
	});

	it("reports a failing source and still lists the others", async () => {
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("api", 3000)]);
		env.tunelo.setDeviceTunnels("pc-2", [httpTunnel("pc", 3000)]);
		const linkId = await linkMachine(ALICE, "pc-2");
		const otherId = await linkMachine(ALICE, "pc-3");
		env.tunelo.revokeDevice("pc-2");
		const revoked = await as(ALICE).get("/client/local-tunnels?refresh=true");
		expect(revoked.body.tunnels).toHaveLength(1);
		expect(revoked.body.failures).toEqual([
			{ source: "link", linkId, reason: "unauthorized" },
		]);

		env.failExchange.add(ALICE);
		env.tunelo.setDown(true);
		const down = await as(ALICE).get("/client/local-tunnels?refresh=true");
		expect(down.status).toBe(200);
		expect(down.body.tunnels).toEqual([]);
		expect(down.body.failures).toEqual([
			{ source: "account", linkId: null, reason: "unavailable" },
			{ source: "link", linkId: otherId, reason: "unavailable" },
		]);
	});

	it("stops calling Tunelo with a refused link token and shows it revoked", async () => {
		env.tunelo.setDeviceTunnels("pc-2", [httpTunnel("pc", 3000)]);
		const linkId = await linkMachine(ALICE, "pc-2");
		env.tunelo.revokeDevice("pc-2");
		await as(ALICE).get("/client/local-tunnels?refresh=true");
		const calls = env.tunelo.authorizations.length;
		const again = await as(ALICE).get("/client/local-tunnels?refresh=true");
		expect(again.body.failures).toEqual([]);
		// Only the account source was called this time.
		expect(env.tunelo.authorizations.slice(calls)).toEqual([
			`Bearer acct:${ALICE}`,
		]);
		const links = await as(ALICE).get("/client/tunnel-links");
		expect(links.body.links).toEqual([
			expect.objectContaining({ id: linkId, revoked: true }),
		]);
		const removed = await as(ALICE).send(
			"delete",
			`/client/tunnel-links/${linkId}`,
		);
		expect(removed.body.links).toEqual([]);
	});

	it("waits out the refresh floor, then reads the list anew", async () => {
		setTuneloDeps({ ...env.deps, refreshMinMs: 300 });
		await as(ALICE).get("/client/local-tunnels");
		env.tunelo.setAccountTunnels(ALICE, [httpTunnel("api", 3000)]);
		const started = Date.now();
		const fresh = await as(ALICE).get("/client/local-tunnels?refresh=true");
		expect(Date.now() - started).toBeGreaterThanOrEqual(250);
		expect(fresh.body.tunnels).toHaveLength(1);
	});

	it("drops rows whose URL is not a tunnel on the tenant's domains", async () => {
		env.tunelo.setAccountTunnels(ALICE, [
			httpTunnel("api", 3000),
			{ ...httpTunnel("evil", 3000), url: "https://evil.example.com" },
			{ ...httpTunnel("path", 3000), url: "https://x.tunnel.hoandat.com/p" },
		]);
		const res = await as(ALICE).get("/client/local-tunnels?port=3000");
		expect(res.body.tunnels.map((t: { url: string }) => t.url)).toEqual([
			"https://api.tunnel.hoandat.com",
		]);
	});

	it("sends the account token of the user's session, never into the answer", async () => {
		await as(ALICE).get("/client/local-tunnels");
		expect(env.tunelo.authorizations).toEqual([`Bearer acct:${ALICE}`]);
		const res = await as(ALICE).get("/client/local-tunnels?refresh=true");
		expect(JSON.stringify(res.body)).not.toContain("acct:");
	});

	it("needs a session and a valid port", async () => {
		expect((await guest().get("/client/local-tunnels")).status).toBe(401);
		const bad = await as(ALICE).get("/client/local-tunnels?port=70000");
		expect(bad.status).toBe(400);
	});
});
