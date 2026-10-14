import { describe, expect, it } from "vitest";
import {
	DEFAULT_RUNTIME_SETTINGS,
	configureRuntime,
} from "../../config/runtime-settings.js";
import { runInTenant } from "../../tenancy/tenant-context.js";
import { guest } from "../../test-support/dashboard-test-app.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { EVE } from "../access/testing/access-fixture.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { servedCollection } from "./collection-link-service.js";
import {
	enableLinkAs,
	sensitiveCollection,
} from "./testing/public-sharing-fixture.js";

useCollectionTestDb();

const read = (linkId: string, ip?: string) =>
	guest(ip).get(`/public/links/${linkId}`);

describe("public link lookups", () => {
	it("limits lookups per client address before reading anything", async () => {
		configureRuntime({
			...DEFAULT_RUNTIME_SETTINGS,
			publicSharingRateLimit: {
				...DEFAULT_RUNTIME_SETTINGS.publicSharingRateLimit,
				publicLinkPerIp: { max: 2, windowMs: 60_000 },
			},
		});
		const ip = "203.0.113.9";
		expect((await read("guess-1", ip)).status).toBe(404);
		expect((await read("guess-2", ip)).status).toBe(404);
		const third = await read("guess-3", ip);
		expect(third.status).toBe(429);
		expect(third.body.error.code).toBe("RATE_LIMITED");
		expect((await read("guess-4", "203.0.113.10")).status).toBe(404);
	});

	it("does not open another tenant's link", async () => {
		const { id } = await sensitiveCollection();
		const linkId = await enableLinkAs(EVE, id, "public");
		const other = { ...TEST_TENANT, id: "ten_AAAAAAAAAAAAAAAA" };
		await expect(
			runInTenant(other, () => servedCollection(linkId, "public")),
		).rejects.toMatchObject({ status: 404 });
	});
});
