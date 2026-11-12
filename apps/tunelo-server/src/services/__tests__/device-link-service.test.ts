import { describe, expect, test } from "vitest";
import { seedCodeLinkToken } from "../../test-support/code-link-token.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import * as deviceLink from "../device-link-service.js";

useTestDatabase("device-link-service");

const { listLinks, revokeLink, revokeOwnLink } = deviceLink;

describe("device link service", () => {
	test("no longer opens, approves or polls code pairings", () => {
		expect(Object.keys(deviceLink).sort()).toEqual([
			"listLinks",
			"revokeLink",
			"revokeOwnLink",
		]);
	});

	test("a machine lists and revokes its own older code links only", async () => {
		await seedCodeLinkToken({ linkedDeviceId: "pc", clientName: "Localman" });

		const links = await listLinks("pc");
		expect(links).toHaveLength(1);
		expect(links[0]).toMatchObject({ clientName: "Localman" });
		const id = links[0]?.id ?? "";

		await expect(revokeLink("someone-else", id)).rejects.toMatchObject({
			code: "TUNELO_LINK_003",
		});
		await revokeLink("pc", id);
		expect(await listLinks("pc")).toEqual([]);
		await expect(revokeLink("pc", "not-an-id")).rejects.toMatchObject({
			statusCode: 404,
		});
	});

	test("a link token can revoke itself", async () => {
		const link = await seedCodeLinkToken({
			linkedDeviceId: "box",
			clientName: "Localman",
		});
		await revokeOwnLink(link.id);
		expect(await listLinks("box")).toEqual([]);
	});
});
