import { describe, expect, it, vi } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import { TunnelLinkModel, linkTokenSlot } from "./tunelo-link-model.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

async function startPairing(
	sub: string,
): Promise<{ id: string; code: string }> {
	const res = await as(sub).send("post", "/client/tunnel-links");
	expect(res.status).toBe(200);
	return { id: res.body.id, code: res.body.code };
}

describe("linking a machine with tunelo link", () => {
	it("opens a pairing, polls pending, then stores the sealed link token", async () => {
		const { id, code } = await startPairing(ALICE);
		expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

		const pending = await as(ALICE).send(
			"post",
			`/client/tunnel-links/${id}/poll`,
		);
		expect(pending.body).toEqual({ status: "pending" });

		expect(env.tunelo.approve(code, "device-1")).toBe(true);
		const linked = await as(ALICE).send(
			"post",
			`/client/tunnel-links/${id}/poll`,
		);
		expect(linked.status).toBe(200);
		expect(linked.body).toEqual({
			status: "linked",
			link: {
				id,
				deviceName: null,
				linkedAt: expect.any(String),
				revoked: false,
			},
		});

		const row = await TunnelLinkModel.findById(id).lean();
		expect(row?.status).toBe("linked");
		expect(row?.requestId).toBeUndefined();
		expect(row?.pendingUntil).toBeUndefined();
		const sealed = row?.tokenSealed ?? "";
		expect(sealed).toMatch(/^v1\./);
		expect(env.cipher.decrypt(sealed, linkTokenSlot(ALICE, id))).toMatch(
			/^link_/,
		);
		// Bound to its owner and row: another user's slot cannot open it.
		expect(() => env.cipher.decrypt(sealed, linkTokenSlot(BOB, id))).toThrow();

		const again = await as(ALICE).send(
			"post",
			`/client/tunnel-links/${id}/poll`,
		);
		expect(again.body.status).toBe("linked");
		const list = await as(ALICE).get("/client/tunnel-links");
		expect(list.body.links).toEqual([linked.body.link]);
	});

	it("reports an expired code and forgets the pairing", async () => {
		const { id } = await startPairing(ALICE);
		await TunnelLinkModel.updateOne(
			{ _id: id },
			{ pendingUntil: new Date(Date.now() - 1000) },
		);
		env.tunelo.expirePairings();
		const res = await as(ALICE).send("post", `/client/tunnel-links/${id}/poll`);
		expect(res.body).toEqual({ status: "expired" });
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("polls and revokes the user's own pairings only", async () => {
		const { id, code } = await startPairing(ALICE);
		env.tunelo.approve(code, "device-1");
		const poll = await as(BOB).send("post", `/client/tunnel-links/${id}/poll`);
		expect(poll.status).toBe(404);
		const remove = await as(BOB).send("delete", `/client/tunnel-links/${id}`);
		expect(remove.status).toBe(404);
		const bogus = await as(ALICE).send(
			"post",
			"/client/tunnel-links/nope/poll",
		);
		expect(bogus.status).toBe(404);
		expect((await as(BOB).get("/client/tunnel-links")).body.links).toEqual([]);
	});

	it("revokes the link token at Tunelo, then forgets the machine", async () => {
		const { id, code } = await startPairing(ALICE);
		env.tunelo.approve(code, "device-1");
		await as(ALICE).send("post", `/client/tunnel-links/${id}/poll`);
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ links: [] });
		expect(env.tunelo.revokedTokens).toHaveLength(1);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("forgets the machine even when Tunelo does not answer", async () => {
		const { id, code } = await startPairing(ALICE);
		env.tunelo.approve(code, "device-1");
		await as(ALICE).send("post", `/client/tunnel-links/${id}/poll`);
		env.tunelo.setDown(true);
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("cancels a pending pairing", async () => {
		const { id } = await startPairing(ALICE);
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(env.tunelo.revokedTokens).toEqual([]);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("answers 502 when Tunelo cannot open a pairing, storing nothing", async () => {
		env.tunelo.setDown(true);
		const res = await as(ALICE).send("post", "/client/tunnel-links");
		expect(res.status).toBe(502);
		expect(res.body.error.code).toBe("TUNELO_UNAVAILABLE");
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("lets a user keep at most three pairings waiting", async () => {
		for (let i = 0; i < 3; i++) await startPairing(ALICE);
		const res = await as(ALICE).send("post", "/client/tunnel-links");
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe("RATE_LIMITED");
		expect((await as(BOB).send("post", "/client/tunnel-links")).status).toBe(
			200,
		);
	});

	it("opens at most five pairings per user in ten minutes, cancelled ones included", async () => {
		await startClearOfRateWindowEdge(10 * 60_000);
		for (let i = 0; i < 5; i++) {
			const { id } = await startPairing(ALICE);
			await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		}
		const res = await as(ALICE).send("post", "/client/tunnel-links");
		expect(res.status).toBe(429);
		expect(res.body.error.code).toBe("RATE_LIMITED");
		expect((await as(BOB).send("post", "/client/tunnel-links")).status).toBe(
			200,
		);
	});

	it("revokes a pairing a concurrent poll linked instead of dropping it", async () => {
		const { id, code } = await startPairing(ALICE);
		env.tunelo.approve(code, "device-1");
		const deleteOne = TunnelLinkModel.deleteOne.bind(TunnelLinkModel);
		// The poll lands between the cancel's read and its delete.
		const raced = async (filter: Record<string, unknown>) => {
			await as(ALICE).send("post", `/client/tunnel-links/${id}/poll`);
			return deleteOne(filter);
		};
		// The service only awaits the result; the query type is not needed.
		vi.spyOn(TunnelLinkModel, "deleteOne").mockImplementationOnce(
			raced as unknown as typeof TunnelLinkModel.deleteOne,
		);
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(env.tunelo.revokedTokens).toHaveLength(1);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
		vi.restoreAllMocks();
	});

	it("never answers or logs a link token", async () => {
		const { id, code } = await startPairing(ALICE);
		env.tunelo.approve(code, "device-1");
		const bodies = [
			await as(ALICE).send("post", `/client/tunnel-links/${id}/poll`),
			await as(ALICE).get("/client/tunnel-links"),
			await as(ALICE).get("/client/local-tunnels"),
		].map((res) => JSON.stringify(res.body));
		env.tunelo.setDown(true);
		await as(ALICE).get("/client/local-tunnels?refresh=true");
		await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		const row = await TunnelLinkModel.findById(id).lean();
		expect(row).toBeNull();
		const secrets = env.tunelo.authorizations
			.map((header) => header.replace(/^Bearer /, ""))
			.filter((token) => token.startsWith("link_"));
		expect(secrets.length).toBeGreaterThan(0);
		const text = [...bodies, ...env.logs.lines].join("\n");
		for (const secret of secrets) expect(text).not.toContain(secret);
		expect(env.logs.lines.length).toBeGreaterThan(0);
	});
});
