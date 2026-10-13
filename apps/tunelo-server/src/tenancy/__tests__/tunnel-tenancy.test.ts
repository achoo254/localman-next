import { describe, expect, test, vi } from "vitest";
import { WebSocket } from "ws";
import { buildTcpUrl, buildTunnelUrl } from "../../config/tunnel-domains.js";
import { extractSubdomain } from "../../request-relay.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { tunnelManager } from "../../tunnel-manager.js";
import {
	idpTenantDirectory,
	singleTenantDirectory,
} from "../tenant-directory.js";
import { type TunnelTenant, runInTenant } from "../tunnel-tenant.js";

const ACME: TunnelTenant = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme",
	issuer: "https://auth.acme.example",
	audience: "https://tunnel.acme.example",
	tunnelDomain: "tunnel.acme.example",
};
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

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

	test("URLs and subdomains follow the tenant's tunnel domain", () => {
		runInTenant(ACME, () => {
			expect(buildTunnelUrl("app")).toBe("https://app.tunnel.acme.example");
			expect(buildTcpUrl(10001)).toBe("tcp://tunnel.acme.example:10001");
			expect(extractSubdomain("app.tunnel.acme.example")).toBe("app");
			expect(extractSubdomain("app.tunnel.hoandat.com")).toBeNull();
		});
		runInTenant(TEST_TENANT, () => {
			expect(buildTunnelUrl("app")).toBe("https://app.tunnel.hoandat.com");
			expect(extractSubdomain("app.tunnel.acme.example")).toBeNull();
		});
	});
});

describe("tenant directory", () => {
	test("without the IdP, another domain's tunnel hosts have no tenant", async () => {
		const single = singleTenantDirectory(TEST_TENANT);
		expect(await single.byHost("app.tunnel.hoandat.com")).toBe(TEST_TENANT);
		expect(await single.byHost("127.0.0.1:3001")).toBe(TEST_TENANT);
		expect(await single.byHost("app.tunnel.acme.example")).toBeUndefined();
	});

	test("asks the IdP for other domains, serving only the domain asked", async () => {
		const summary = {
			id: ACME.id,
			domain: "acme.example",
			displayName: "Acme",
			issuer: ACME.issuer,
			status: "active",
			resources: {
				localman: "https://localman.acme.example",
				tunnel: "https://tunnel.acme.example",
			},
			ownerSubs: [],
		};
		const byHost = vi.fn(async (host: string) =>
			host === "tunnel.acme.example" ? summary : undefined,
		);
		const dir = idpTenantDirectory({
			primary: TEST_TENANT,
			api: { byHost, byId: async () => undefined },
			logger,
		});
		expect(await dir.byHost("app.tunnel.acme.example")).toEqual(ACME);
		expect(await dir.byHost("tunnel.acme.example:443")).toEqual(ACME);
		expect(await dir.byHost("x.tunnel.hoandat.com")).toBe(TEST_TENANT);
		expect(await dir.byHost("localman.acme.example")).toBeUndefined();
		expect(byHost).toHaveBeenCalledTimes(1);
	});
});
