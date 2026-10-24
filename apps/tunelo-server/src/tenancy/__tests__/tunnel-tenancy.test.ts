import { describe, expect, test } from "vitest";
import { WebSocket } from "ws";
import { buildTcpUrl, buildTunnelUrl } from "../../config/tunnel-domains.js";
import { extractSubdomain } from "../../request-relay.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { tunnelManager } from "../../tunnel-manager.js";
import { primaryTenantDirectory } from "../tenant-directory.js";
import { type TunnelTenant, runInTenant } from "../tunnel-tenant.js";

const ACME: TunnelTenant = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme",
	issuer: "https://auth.acme.example",
	audience: "https://tunnel.acme.example",
	tunnelDomain: "tunnel.acme.example",
};

function registerApp(connectionId: string): boolean {
	const socket: WebSocket = Object.create(WebSocket.prototype);
	return tunnelManager.register({
		subdomain: "app",
		socket,
		connectionId,
		apiKeyHash: `hash-${connectionId}`,
		userId: "u",
		keyId: "k",
		owner: { ownerSub: "sub", deviceId: null, deviceName: "laptop" },
		localPort: 3000,
	});
}

describe("tunnels per tenant", () => {
	test("the same subdomain is a separate tunnel on each tenant's domain", () => {
		expect(runInTenant(TEST_TENANT, () => registerApp("c-primary"))).toBe(true);
		expect(runInTenant(ACME, () => registerApp("c-acme"))).toBe(true);
		expect(runInTenant(ACME, () => registerApp("c-acme-2"))).toBe(false);
		expect(
			runInTenant(ACME, () => tunnelManager.get("app")?.connectionId),
		).toBe("c-acme");
		expect(
			runInTenant(TEST_TENANT, () => tunnelManager.getAllConnections().length),
		).toBe(1);
		expect(runInTenant(ACME, () => tunnelManager.countByOwner("sub"))).toBe(1);
		expect(runInTenant(ACME, () => tunnelManager.getTenantStats())).toEqual({
			activeTunnels: 1,
		});
		tunnelManager.unregisterByConnectionId("c-acme");
		expect(runInTenant(ACME, () => tunnelManager.has("app"))).toBe(false);
		expect(runInTenant(TEST_TENANT, () => tunnelManager.has("app"))).toBe(true);
		tunnelManager.unregisterByConnectionId("c-primary");
	});

	test("URLs and subdomains use the primary tunnel domains", () => {
		expect(buildTunnelUrl("app")).toBe("https://app.tunnel.hoandat.com");
		expect(buildTcpUrl(10001)).toBe("tcp://tunnel.hoandat.com:10001");
		expect(extractSubdomain("app.tunnel.hoandat.com")).toBe("app");
		expect(extractSubdomain("app.tunnel.example.test")).toBe("app");
		expect(extractSubdomain("app.tunnel.acme.example")).toBeNull();
	});
});

const PRODUCTION = {
	tunnelDomains: ["tunnel.hoandat.com", "tunnel.example.test"],
	loopback: false,
};

describe("tenant directory", () => {
	test("serves the tunnel domains, apex and subdomains, any case and port", async () => {
		const directory = primaryTenantDirectory(TEST_TENANT, PRODUCTION);
		for (const host of [
			"tunnel.hoandat.com",
			"app.tunnel.hoandat.com",
			"APP.tunnel.hoandat.com:443",
			"app.tunnel.example.test",
		]) {
			expect(await directory.byHost(host), host).toBe(TEST_TENANT);
		}
		expect(await directory.byId("primary")).toBe(TEST_TENANT);
		expect(await directory.byId(ACME.id)).toBeUndefined();
	});

	test("refuses any other host, loopback too in production", async () => {
		const directory = primaryTenantDirectory(TEST_TENANT, PRODUCTION);
		for (const host of [
			"evil.example",
			"1.2.3.4",
			"1.2.3.4:3001",
			"app.tunnel.acme.example",
			"tunnel.hoandat.com.evil.example",
			"localman.hoandat.com",
			"127.0.0.1:3001",
			"localhost:3001",
			"",
		]) {
			expect(await directory.byHost(host), host).toBeUndefined();
		}
	});

	test("serves loopback outside production", async () => {
		const directory = primaryTenantDirectory(TEST_TENANT, {
			...PRODUCTION,
			loopback: true,
		});
		expect(await directory.byHost("127.0.0.1:3001")).toBe(TEST_TENANT);
		expect(await directory.byHost("localhost:3001")).toBe(TEST_TENANT);
		expect(await directory.byHost("evil.example")).toBeUndefined();
	});
});
