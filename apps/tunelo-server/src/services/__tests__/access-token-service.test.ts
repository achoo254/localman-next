import { describe, expect, test } from "vitest";
import { hashToken } from "../../auth/token-hash.js";
import { ApiKey } from "../../db/models/api-key-model.js";
import { seedCodeLinkToken } from "../../test-support/code-link-token.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { issueAccessToken } from "../access-token-service.js";

useTestDatabase("access-token-service");

async function statusOf(token: string): Promise<string | undefined> {
	const row = await ApiKey.findOne({ keyHash: hashToken(token) }).lean();
	return row?.status;
}

describe("access token service", () => {
	test("logging in again revokes the device's old token but not its links", async () => {
		const first = await issueAccessToken("device:mac", { deviceId: "mac" });
		const link = await seedCodeLinkToken({
			linkedDeviceId: "mac",
			clientName: "Localman",
		});
		const second = await issueAccessToken("device:mac", { deviceId: "mac" });

		expect(await statusOf(first.token)).toBe("revoked");
		expect(await statusOf(second.token)).toBe("active");
		expect(await statusOf(link.token)).toBe("active");
	});

	test("rows written before scopes existed still count as full-rights", async () => {
		// As startup leaves it: rows from before tenants carry the primary one.
		await ApiKey.collection.insertOne({
			tenantId: TEST_TENANT.id,
			keyHash: hashToken("tunelo_old"),
			keyPrefix: "tunelo_old",
			deviceId: "old-mac",
			status: "active",
		});
		await issueAccessToken("device:old-mac", { deviceId: "old-mac" });
		expect(await statusOf("tunelo_old")).toBe("revoked");
	});
});
