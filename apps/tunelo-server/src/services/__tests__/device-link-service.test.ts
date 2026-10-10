import { describe, expect, test } from "vitest";
import { LinkRequest } from "../../db/models/link-request-model.js";
import { useTestDatabase } from "../../test-support/test-mongo.js";
import {
	MAX_WRONG_CODES,
	approveLink,
	initLink,
	listLinks,
	normalizeLinkCode,
	pollLink,
	revokeLink,
	revokeOwnLink,
} from "../device-link-service.js";

useTestDatabase("device-link-service");

describe("device link service", () => {
	test("init, approve, then poll hands the token out exactly once", async () => {
		const { requestId, code } = await initLink("Localman");
		expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
		expect(await pollLink(requestId)).toEqual({ status: "pending" });

		await approveLink(code.toLowerCase(), { keyId: "k-ok", deviceId: "mac" });
		const first = await pollLink(requestId);
		expect(first).toMatchObject({ status: "approved" });
		expect(first.status === "approved" && first.token).toMatch(/^tunelo_/);
		expect(await pollLink(requestId)).toEqual({ status: "expired" });
	});

	test("a code works once", async () => {
		const { code } = await initLink("Localman");
		await approveLink(code, { keyId: "k-once", deviceId: "mac" });
		await expect(
			approveLink(code, { keyId: "k-once", deviceId: "mac" }),
		).rejects.toMatchObject({ code: "TUNELO_LINK_001" });
	});

	test("an expired code is refused", async () => {
		const { requestId, code } = await initLink("Localman");
		await LinkRequest.updateOne(
			{ requestId },
			{ expiresAt: new Date(Date.now() - 1000) },
		);
		await expect(
			approveLink(code, { keyId: "k-exp", deviceId: "mac" }),
		).rejects.toMatchObject({ code: "TUNELO_LINK_001" });
		expect(await pollLink(requestId)).toEqual({ status: "expired" });
	});

	test("an approval nobody collects in time leaves no token behind", async () => {
		const { requestId, code } = await initLink("Localman");
		await approveLink(code, { keyId: "k-late", deviceId: "late-box" });
		await LinkRequest.updateOne(
			{ requestId },
			{ expiresAt: new Date(Date.now() - 1000) },
		);
		expect(await pollLink(requestId)).toEqual({ status: "expired" });
		expect(await listLinks("late-box")).toEqual([]);
		expect(await LinkRequest.findOne({ requestId }).lean()).not.toHaveProperty(
			"issuedToken",
		);
	});

	test("five wrong codes lock the approving token, even for a right code", async () => {
		const { code } = await initLink("Localman");
		for (let i = 0; i < MAX_WRONG_CODES; i++) {
			await expect(
				approveLink("ZZZZ-ZZZZ", { keyId: "k-bad", deviceId: "mac" }),
			).rejects.toMatchObject({ code: "TUNELO_LINK_001" });
		}
		await expect(
			approveLink(code, { keyId: "k-bad", deviceId: "mac" }),
		).rejects.toMatchObject({ code: "TUNELO_LINK_002", statusCode: 429 });
	});

	test("a machine lists and revokes its own links only", async () => {
		const { requestId, code } = await initLink("Localman");
		await approveLink(code, { keyId: "k-list", deviceId: "pc" });
		await pollLink(requestId);

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
		const { requestId, code } = await initLink("Localman");
		await approveLink(code, { keyId: "k-self", deviceId: "box" });
		const polled = await pollLink(requestId);
		const linkId = polled.status === "approved" ? polled.linkId : "";
		await revokeOwnLink(linkId);
		expect(await listLinks("box")).toEqual([]);
	});

	test("normalizes typed codes", () => {
		expect(normalizeLinkCode(" abcd efgh ")).toBe("ABCDEFGH");
		expect(normalizeLinkCode("ABCD-EFG")).toBeNull();
		expect(normalizeLinkCode("ABCD-EFG0")).toBeNull();
	});
});
