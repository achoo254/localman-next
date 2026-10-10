import { describe, expect, test } from "vitest";
import { hashToken } from "../../auth/token-hash.js";
import { ApiKey } from "../../db/models/api-key-model.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import { issueAccessToken, issueLinkToken } from "../access-token-service.js";

useTestDatabase("access-token-service");

async function statusOf(token: string): Promise<string | undefined> {
	const row = await ApiKey.findOne({ keyHash: hashToken(token) }).lean();
	return row?.status;
}

describe("access token service", () => {
	test("logging in again revokes the device's old token but not its links", async () => {
		const first = await issueAccessToken("device:mac", { deviceId: "mac" });
		const link = await issueLinkToken({
			linkedDeviceId: "mac",
			clientName: "Localman",
		});
		const second = await issueAccessToken("device:mac", { deviceId: "mac" });

		expect(await statusOf(first.token)).toBe("revoked");
		expect(await statusOf(second.token)).toBe("active");
		expect(await statusOf(link.token)).toBe("active");
	});

	test("rows written before scopes existed still count as full-rights", async () => {
		await ApiKey.collection.insertOne({
			keyHash: hashToken("tunelo_old"),
			keyPrefix: "tunelo_old",
			deviceId: "old-mac",
			status: "active",
		});
		await issueAccessToken("device:old-mac", { deviceId: "old-mac" });
		expect(await statusOf("tunelo_old")).toBe("revoked");
	});

	test("a link token is read-only and has no deviceId", async () => {
		const link = await issueLinkToken({
			linkedDeviceId: "pc",
			clientName: "Localman",
		});
		const row = await ApiKey.findOne({ keyHash: hashToken(link.token) }).lean();
		expect(row).toMatchObject({
			scopes: ["tunnels:read"],
			linkedDeviceId: "pc",
			deviceId: null,
			clientName: "Localman",
		});
		expect(link.token.startsWith("tunelo_")).toBe(true);
	});
});
