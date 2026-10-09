import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { UserModel } from "../users/user-model.js";
import {
	ClientSettingsModel,
	MAX_TUNNEL_MAPPINGS,
} from "./client-settings-model.js";
import {
	ALICE,
	TEST_TUNNEL_DOMAINS,
	as,
	useClientStoreDb,
} from "./testing/client-store-fixture.js";

useClientStoreDb();

describe("client tunnel mappings", () => {
	it("maps a local target to a tunnel origin, canonical key, replace and delete", async () => {
		const set = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/127.0.0.1:3000",
			{ url: " https://Demo.tunnel.hoandat.com:443/ " },
		);
		expect(set.status).toBe(200);
		expect(set.body.tunnelMappings).toEqual([
			{
				key: "localhost:3000",
				url: "https://demo.tunnel.hoandat.com",
				enabled: true,
			},
		]);
		const replaced = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:3000",
			{ url: "https://other.tunnel.hoandat.com" },
		);
		expect(replaced.body.tunnelMappings).toEqual([
			{
				key: "localhost:3000",
				url: "https://other.tunnel.hoandat.com",
				enabled: true,
			},
		]);
		const removed = await as(ALICE).send(
			"delete",
			"/client/tunnel-mappings/localhost:3000",
		);
		expect(removed.body.tunnelMappings).toEqual([]);
	});

	it("rejects a non-local key and any URL but a bare Tunelo tunnel", async () => {
		const url = "https://demo.tunnel.hoandat.com";
		const cases: [string, string][] = [
			["api.example.com:443", url],
			["localhost", url],
			["localhost:3000", "http://192.168.1.5:8080"],
			["localhost:3000", "ftp://demo.example.com"],
			["localhost:3000", "http://demo.tunnel.hoandat.com"],
			["localhost:3000", "https://demo.tunnel.hoandat.com:8443"],
			["localhost:3000", "https://demo.tunnel.hoandat.com/path"],
			["localhost:3000", "https://demo.tunnel.hoandat.com/?x=1"],
			["localhost:3000", "https://demo.tunnel.hoandat.com/#top"],
			["localhost:3000", "https://user:pw@demo.tunnel.hoandat.com"],
			["localhost:3000", "https://a.b.tunnel.hoandat.com"],
			["localhost:3000", "https://tunnel.hoandat.com"],
			["localhost:3000", "https://evil.example"],
			["localhost:3000", "https://demo.tunnel.hoandat.com.evil.example"],
		];
		for (const [key, target] of cases) {
			const res = await as(ALICE).send(
				"put",
				`/client/tunnel-mappings/${key}`,
				{
					url: target,
				},
			);
			expect(res.status, `${key} -> ${target}`).toBe(400);
			expect(res.body.error.code).toBe("VALIDATION_ERROR");
		}
	});

	it(`keeps at most ${MAX_TUNNEL_MAPPINGS} tunnel mappings`, async () => {
		await ClientSettingsModel.create({
			userSub: ALICE,
			tunnelMappings: Array.from({ length: MAX_TUNNEL_MAPPINGS }, (_, i) => ({
				key: `localhost:${3000 + i}`,
				url: "https://demo.tunnel.hoandat.com",
			})),
		});
		const body = { url: "https://new.tunnel.hoandat.com" };
		const refused = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:9999",
			body,
		);
		expect(refused.status).toBe(409);
		expect(refused.body.error.code).toBe("TUNNEL_MAPPING_LIMIT_REACHED");
		const known = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:3000",
			body,
		);
		expect(known.status).toBe(200);
	});

	it("explains a refused URL in the user's language, with the domains", async () => {
		await UserModel.create({ sub: ALICE, username: "alice", locale: "vi" });
		const res = await as(ALICE).send(
			"put",
			"/client/tunnel-mappings/localhost:3000",
			{ url: "https://evil.example" },
		);
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("VALIDATION_ERROR");
		expect(res.body.error.message).toContain("URL tunnel");
		expect(res.body.error.message).toContain("tunnel.hoandat.com");
	});

	it("refuses every tunnel URL when no tunnel domain is configured", async () => {
		configureRuntime({ ...DEFAULT_RUNTIME_SETTINGS, tunnelDomains: [] });
		try {
			const res = await as(ALICE).send(
				"put",
				"/client/tunnel-mappings/localhost:3000",
				{ url: "https://demo.tunnel.hoandat.com" },
			);
			expect(res.status).toBe(400);
			expect(res.body.error.message).toBe(
				"Tunnel URLs are not enabled on this server.",
			);
			const settings = await as(ALICE).get("/client/settings");
			expect(settings.body.tunnelDomains).toEqual([]);
		} finally {
			configureRuntime({
				...DEFAULT_RUNTIME_SETTINGS,
				tunnelDomains: TEST_TUNNEL_DOMAINS,
			});
		}
	});
});
