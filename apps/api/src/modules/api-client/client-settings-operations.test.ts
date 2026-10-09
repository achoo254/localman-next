import { describe, expect, it } from "vitest";
import {
	ClientSettingsModel,
	MAX_ROUTING_HOSTS,
} from "./client-settings-model.js";
import {
	ALICE,
	BOB,
	TEST_TUNNEL_DOMAINS,
	as,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

const DEFAULTS = {
	routingHosts: [],
	secretProxyHosts: [],
	tunnelMappings: [],
	defaultRoute: "auto",
	sendClientIp: true,
	tunnelDomains: TEST_TUNNEL_DOMAINS,
};

describe("client settings", () => {
	it("returns defaults before anything is changed, without writing", async () => {
		const res = await as(ALICE).get("/client/settings");
		expect(res.body).toEqual(DEFAULTS);
		expect(await ClientSettingsModel.countDocuments()).toBe(0);
	});

	it("updates the default route and client-IP forwarding", async () => {
		const res = await as(ALICE).send("put", "/client/settings", {
			defaultRoute: "proxy",
		});
		expect(res.body).toMatchObject({
			defaultRoute: "proxy",
			sendClientIp: true,
		});
		const next = await as(ALICE).send("put", "/client/settings", {
			sendClientIp: false,
		});
		expect(next.body).toMatchObject({
			defaultRoute: "proxy",
			sendClientIp: false,
		});
		const bad = await as(ALICE).send("put", "/client/settings", {
			defaultRoute: "carrier-pigeon",
		});
		expect(bad.status).toBe(400);
	});

	it("remembers and forgets hosts that need the proxy", async () => {
		await as(ALICE).send("put", "/client/routing-hosts/API.Example.com:8443");
		const twice = await as(ALICE).send(
			"put",
			"/client/routing-hosts/api.example.com:8443",
		);
		await as(ALICE).send("put", "/client/routing-hosts/other.example.com");
		expect(twice.body.routingHosts).toEqual(["api.example.com:8443"]);
		const both = await as(ALICE).get("/client/settings");
		expect(both.body.routingHosts).toEqual([
			"api.example.com:8443",
			"other.example.com",
		]);
		const forgot = await as(ALICE).send(
			"delete",
			"/client/routing-hosts/api.example.com:8443",
		);
		expect(forgot.body.routingHosts).toEqual(["other.example.com"]);
		const bad = await as(ALICE).send("put", "/client/routing-hosts/a@b.com");
		expect(bad.status).toBe(400);
	});

	it(`remembers at most ${MAX_ROUTING_HOSTS} hosts`, async () => {
		await ClientSettingsModel.create({
			userSub: ALICE,
			routingHosts: Array.from(
				{ length: MAX_ROUTING_HOSTS },
				(_, i) => `h${i}.example.com`,
			),
		});
		const refused = await as(ALICE).send("put", "/client/routing-hosts/new.io");
		expect(refused.status).toBe(409);
		expect(refused.body.error.code).toBe("ROUTING_HOST_LIMIT_REACHED");
		const known = await as(ALICE).send(
			"put",
			"/client/routing-hosts/h0.example.com",
		);
		expect(known.status).toBe(200);
	});

	it("keeps each user's settings and tunnel mappings private", async () => {
		await as(ALICE).send("put", "/client/tunnel-mappings/localhost:3000", {
			url: "https://alice.tunnel.hoandat.com",
		});
		await as(ALICE).send("put", "/client/routing-hosts/api.example.com");
		await as(ALICE).send("put", "/client/settings", { defaultRoute: "direct" });
		expect((await as(BOB).get("/client/settings")).body).toEqual(DEFAULTS);
		await as(BOB).send("delete", "/client/tunnel-mappings/localhost:3000");
		await as(BOB).send("delete", "/client/routing-hosts/api.example.com");
		const alice = await as(ALICE).get("/client/settings");
		expect(alice.body).toEqual({
			routingHosts: ["api.example.com"],
			secretProxyHosts: [],
			tunnelMappings: [
				{
					key: "localhost:3000",
					url: "https://alice.tunnel.hoandat.com",
					enabled: true,
				},
			],
			defaultRoute: "direct",
			sendClientIp: true,
			tunnelDomains: TEST_TUNNEL_DOMAINS,
		});
	});
});
