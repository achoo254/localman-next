import { describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { seedCodeLinkedMachine } from "./testing/code-linked-machine.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import { TunnelLinkModel } from "./tunelo-link-model.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

describe("linked machines without the code pairing", () => {
	it("no longer opens or polls a code pairing", async () => {
		const start = await as(ALICE).send("post", "/client/tunnel-links");
		expect(start.status).toBe(404);
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		const poll = await as(ALICE).send(
			"post",
			`/client/tunnel-links/${id}/poll`,
		);
		expect(poll.status).toBe(404);
		expect(await TunnelLinkModel.countDocuments()).toBe(1);
	});

	it("lists an older code link of the user's own", async () => {
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		const list = await as(ALICE).get("/client/tunnel-links");
		expect(list.status).toBe(200);
		expect(list.body.links).toEqual([
			{
				id,
				source: "pairing",
				deviceName: null,
				machineId: null,
				forwardEnabled: false,
				linkedAt: expect.any(String),
				revoked: false,
			},
		]);
		expect((await as(BOB).get("/client/tunnel-links")).body.links).toEqual([]);
	});

	it("revokes the user's own links only", async () => {
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		const remove = await as(BOB).send("delete", `/client/tunnel-links/${id}`);
		expect(remove.status).toBe(404);
		const bogus = await as(ALICE).send("delete", "/client/tunnel-links/nope");
		expect(bogus.status).toBe(404);
		expect(await TunnelLinkModel.countDocuments()).toBe(1);
	});

	it("revokes the link token at Tunelo, then forgets the machine", async () => {
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ links: [] });
		expect(env.tunelo.revokedTokens).toHaveLength(1);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("forgets the machine even when Tunelo does not answer", async () => {
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		env.tunelo.setDown(true);
		const res = await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(res.status).toBe(200);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("drops a row that has no token without calling Tunelo", async () => {
		const row = await TunnelLinkModel.create({
			userSub: ALICE,
			status: "linked",
		});
		const res = await as(ALICE).send(
			"delete",
			`/client/tunnel-links/${String(row._id)}`,
		);
		expect(res.status).toBe(200);
		expect(env.tunelo.revokedTokens).toEqual([]);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("never answers or logs a link token", async () => {
		const id = await seedCodeLinkedMachine(env, ALICE, "device-1");
		const bodies = [
			await as(ALICE).get("/client/tunnel-links"),
			await as(ALICE).get("/client/local-tunnels"),
		].map((res) => JSON.stringify(res.body));
		env.tunelo.setDown(true);
		await as(ALICE).get("/client/local-tunnels?refresh=true");
		await as(ALICE).send("delete", `/client/tunnel-links/${id}`);
		expect(await TunnelLinkModel.findById(id).lean()).toBeNull();
		const secrets = env.tunelo.authorizations
			.map((header) => header.replace(/^Bearer /, ""))
			.filter((token) => token.startsWith("link_"));
		expect(secrets.length).toBeGreaterThan(0);
		const text = [...bodies, ...env.logs.lines].join("\n");
		for (const secret of secrets) expect(text).not.toContain(secret);
		expect(env.logs.lines.length).toBeGreaterThan(0);
	});
});
