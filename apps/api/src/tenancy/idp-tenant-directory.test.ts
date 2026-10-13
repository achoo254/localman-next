import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger.js";
import { TEST_TENANT } from "../test-support/test-tenant.js";
import { createIdpTenantClient } from "./idp-tenant-client.js";
import {
	createIdpTenantDirectory,
	localmanDomainOf,
} from "./idp-tenant-directory.js";
import { TENANT_FRESH_MS } from "./tenant-answer-cache.js";
import type { LocalmanTenant } from "./tenant-context.js";

const ACME: LocalmanTenant = {
	id: "ten_AAAAAAAAAAAAAAAA",
	domain: "acme.example",
	displayName: "Acme",
	issuer: "https://auth.acme.example",
	publicUrl: "https://localman.acme.example",
	mockBaseDomain: "localman.acme.example",
	ownerSubs: new Set(["acc_owner"]),
};

function directory() {
	let time = 0;
	const byHost = vi.fn(async (host: string) =>
		host === "localman.acme.example" ? ACME : undefined,
	);
	const byId = vi.fn(async (id: string) => (id === ACME.id ? ACME : undefined));
	const dir = createIdpTenantDirectory({
		primary: TEST_TENANT,
		client: { byHost, byId },
		logger: createLogger("silent"),
		now: () => time,
	});
	const advance = (ms: number): void => {
		time += ms;
	};
	return { dir, byHost, byId, advance };
}

describe("localmanDomainOf", () => {
	it("reads the domain of dashboard and mock hosts only", () => {
		expect(localmanDomainOf("localman.acme.example")).toBe("acme.example");
		expect(localmanDomainOf("abc.localman.acme.example")).toBe("acme.example");
		for (const host of [
			"acme.example",
			"auth.acme.example",
			"a.b.localman.acme.example",
			"localman.example",
			"localman.acme.example:443",
			"localman..example",
		]) {
			expect(localmanDomainOf(host), host).toBeUndefined();
		}
	});
});

describe("IdP tenant directory", () => {
	it("serves the primary tenant's hosts without asking the IdP", async () => {
		const { dir, byHost } = directory();
		for (const host of [
			"localman.test",
			"abc.localman.test",
			"LOCALMAN.TEST",
		]) {
			expect(await dir.byHost(host)).toBe(TEST_TENANT);
		}
		expect(await dir.byHost("localman.sub.localman.test")).toBe(TEST_TENANT);
		expect(await dir.byId("primary")).toBe(TEST_TENANT);
		expect(byHost).not.toHaveBeenCalled();
	});

	it("asks once per domain while fresh, and learns the tenant's id", async () => {
		const { dir, byHost, byId, advance } = directory();
		expect(await dir.byHost("localman.acme.example")).toBe(ACME);
		expect(await dir.byHost("x1.localman.acme.example")).toBe(ACME);
		expect(await dir.byId(ACME.id)).toBe(ACME);
		expect(byHost).toHaveBeenCalledTimes(1);
		expect(byId).not.toHaveBeenCalled();
		advance(TENANT_FRESH_MS);
		await dir.byHost("localman.acme.example");
		expect(byHost).toHaveBeenCalledTimes(2);
	});

	it("keeps serving a known tenant while the IdP is down, not an unseen one", async () => {
		const { dir, byHost, advance } = directory();
		await dir.byHost("localman.acme.example");
		advance(TENANT_FRESH_MS * 10);
		byHost.mockRejectedValue(new Error("IdP restarting"));
		expect(await dir.byHost("localman.acme.example")).toBe(ACME);
		await expect(dir.byHost("localman.other.example")).rejects.toThrow(
			"IdP restarting",
		);
		expect(await dir.byHost("localman.test")).toBe(TEST_TENANT);
	});

	it("remembers a 404, and never asks for hosts that are not Localman's", async () => {
		const { dir, byHost } = directory();
		expect(await dir.byHost("localman.nope.example")).toBeUndefined();
		expect(await dir.byHost("localman.nope.example")).toBeUndefined();
		expect(await dir.byHost("evil.example")).toBeUndefined();
		expect(await dir.byHost("tunnel.acme.example")).toBeUndefined();
		expect(byHost).toHaveBeenCalledTimes(1);
	});
});

describe("IdP tenant client", () => {
	it("authenticates as Localman, maps a summary and reads 404 as no tenant", async () => {
		const calls: { url: string; authorization: string | null }[] = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			const url = String(input);
			calls.push({
				url,
				authorization: new Headers(init?.headers).get("authorization"),
			});
			if (url.includes("missing")) return new Response(null, { status: 404 });
			if (url.includes("broken")) return new Response(null, { status: 502 });
			return Response.json({
				id: ACME.id,
				domain: "acme.example",
				displayName: "Acme",
				issuer: "https://auth.acme.example",
				status: "active",
				resources: { localman: "https://localman.acme.example" },
				ownerSubs: ["acc_owner"],
			});
		};
		const client = createIdpTenantClient(
			"http://127.0.0.1:4501",
			"s".repeat(32),
			fetchImpl,
		);
		expect(await client.byHost("localman.acme.example")).toEqual(ACME);
		expect(await client.byId("missing")).toBeUndefined();
		await expect(client.byId("broken")).rejects.toThrow("502");
		expect(calls[0]).toEqual({
			url: "http://127.0.0.1:4501/internal/tenants/lookup?host=localman.acme.example",
			authorization: `Basic ${Buffer.from(`localman:${"s".repeat(32)}`).toString("base64")}`,
		});
	});
});
