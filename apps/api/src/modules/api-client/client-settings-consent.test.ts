import { describe, expect, it } from "vitest";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import {
	ClientSettingsModel,
	MAX_SECRET_PROXY_HOSTS,
} from "./client-settings-model.js";
import {
	ALICE,
	BOB,
	as,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

const TUNNEL = "https://demo.tunnel.hoandat.com";

describe("client settings: secret consent and tunnel switches", () => {
	it("remembers and forgets hosts where credentials may go through the proxy", async () => {
		await as(ALICE).send("put", "/client/secret-proxy-hosts/API.Example.com");
		const twice = await as(ALICE).send(
			"put",
			"/client/secret-proxy-hosts/api.example.com",
		);
		const local = await as(ALICE).send(
			"put",
			"/client/secret-proxy-hosts/localhost:3000",
		);
		expect(twice.body.secretProxyHosts).toEqual(["api.example.com"]);
		expect(local.body.secretProxyHosts).toEqual([
			"api.example.com",
			"localhost:3000",
		]);
		expect(local.body.routingHosts).toEqual([]);
		const forgot = await as(ALICE).send(
			"delete",
			"/client/secret-proxy-hosts/api.example.com",
		);
		expect(forgot.body.secretProxyHosts).toEqual(["localhost:3000"]);
		const bad = await as(ALICE).send(
			"put",
			"/client/secret-proxy-hosts/https:%2F%2Fa.io",
		);
		expect(bad.status).toBe(400);
		expect(
			(await as(BOB).get("/client/settings")).body.secretProxyHosts,
		).toEqual([]);
	});

	it(`allows secrets for at most ${MAX_SECRET_PROXY_HOSTS} hosts`, async () => {
		await ClientSettingsModel.create({
			userSub: ALICE,
			secretProxyHosts: Array.from(
				{ length: MAX_SECRET_PROXY_HOSTS },
				(_, i) => `h${i}.example.com`,
			),
		});
		const refused = await as(ALICE).send(
			"put",
			"/client/secret-proxy-hosts/new.io",
		);
		expect(refused.status).toBe(409);
		expect(refused.body.error.code).toBe("SECRET_PROXY_HOST_LIMIT_REACHED");
	});

	it("turns a tunnel mapping off and on without losing its URL", async () => {
		const off = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:3000",
			{ url: TUNNEL, enabled: false },
		);
		expect(off.body.tunnelMappings).toEqual([
			{ key: "localhost:3000", url: TUNNEL, enabled: false },
		]);
		const on = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:3000",
			{ url: TUNNEL, enabled: true },
		);
		expect(on.body.tunnelMappings).toEqual([
			{ key: "localhost:3000", url: TUNNEL, enabled: true },
		]);
	});

	it("reads a mapping stored before the switch existed as enabled", async () => {
		await ClientSettingsModel.collection.insertOne({
			tenantId: TEST_TENANT.id,
			userSub: ALICE,
			tunnelMappings: [{ key: "localhost:8080", url: TUNNEL }],
		});
		const res = await as(ALICE).get("/client/settings");
		expect(res.body.tunnelMappings).toEqual([
			{ key: "localhost:8080", url: TUNNEL, enabled: true },
		]);
		expect(res.body.secretProxyHosts).toEqual([]);
	});
});
