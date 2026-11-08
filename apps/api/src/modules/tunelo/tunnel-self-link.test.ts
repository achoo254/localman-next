import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { createTestIdp } from "../mcp/testing/idp-token-signer.js";
import {
	SESSION_COOKIE,
	createMcpTestApp,
} from "../mcp/testing/localman-mcp-harness.js";
import { useFakeSelfLinks } from "./testing/fake-self-links.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import {
	MAX_TUNNEL_LINKS,
	TunnelLinkModel,
	linkTokenSlot,
} from "./tunelo-link-model.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";
const DEVICE = "chat-agent.1111";
const MACHINE = { machineId: "1111", machineName: "Laptop" };
const PATH = "/tunelo/links/self";

let idp: Awaited<ReturnType<typeof createTestIdp>>;
let app: ReturnType<typeof createMcpTestApp>;
beforeAll(async () => {
	idp = await createTestIdp();
	app = createMcpTestApp(idp);
});

async function bearer(sub: string, scope = "machines:write mock:read") {
	return `Bearer ${await idp.sign({ sub, scope, clientId: "tunelo-agent" })}`;
}

async function link(sub: string, body: object, scope?: string) {
	return request(app)
		.post(PATH)
		.set("authorization", await bearer(sub, scope))
		.send(body);
}

describe("the tunelo process links its machine", () => {
	it("stores the sealed token under the account the token is for", async () => {
		const self = useFakeSelfLinks(env.tunelo).mint(ALICE, DEVICE);
		const res = await link(ALICE, { token: self.token, ...MACHINE });
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(res.body.link).toMatchObject({
			source: "self",
			deviceName: "Laptop",
			machineId: "1111",
			forwardEnabled: true,
			revoked: false,
		});
		const id = String(res.body.link.id);
		const row = await TunnelLinkModel.findById(id).lean();
		expect(row).toMatchObject({
			userSub: ALICE,
			deviceId: DEVICE,
			forwardUrl: self.forwardUrl,
			linkId: self.linkId,
		});
		const slot = linkTokenSlot(ALICE, id);
		expect(env.cipher.decrypt(row?.tokenSealed ?? "", slot)).toBe(self.token);
		const listed = await as(ALICE).get("/client/tunnel-links");
		expect(listed.body.links).toEqual([res.body.link]);
	});

	it("refuses a token of another account's machine", async () => {
		const bobs = useFakeSelfLinks(env.tunelo).mint(BOB, DEVICE);
		const res = await link(ALICE, { token: bobs.token, ...MACHINE });
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("LINK_OWNER_MISMATCH");
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("needs machines:write on a Bearer token, never the session", async () => {
		const self = useFakeSelfLinks(env.tunelo).mint(ALICE, DEVICE);
		const body = { token: self.token, ...MACHINE };
		const noScope = await link(ALICE, body, "mock:read client:send");
		expect(noScope.status).toBe(403);
		expect(noScope.headers["www-authenticate"]).toContain("machines:write");
		const cookie = await request(app)
			.post(PATH)
			.set("cookie", SESSION_COOKIE)
			.send(body);
		expect(cookie.status).toBe(401);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("rejects malformed input and tokens Tunelo does not know", async () => {
		useFakeSelfLinks(env.tunelo);
		const bad = await link(ALICE, { token: "x", machineId: "a b" });
		expect(bad.status).toBe(400);
		const unknown = await link(ALICE, { token: "tunelo_nope", ...MACHINE });
		expect(unknown.body.error.code).toBe("INVALID_LINK_TOKEN");
	});

	it("refuses a forward URL outside this server's tunnel domains", async () => {
		const self = useFakeSelfLinks(env.tunelo).mint(
			ALICE,
			DEVICE,
			"https://m-1.evil.example/.tunelo/forward",
		);
		const res = await link(ALICE, { token: self.token, ...MACHINE });
		expect(res.status).toBe(502);
		expect(await TunnelLinkModel.countDocuments()).toBe(0);
	});

	it("linking again replaces the token, keeps the row and the switch", async () => {
		const links = useFakeSelfLinks(env.tunelo);
		const first = links.mint(ALICE, DEVICE);
		const id = (await link(ALICE, { token: first.token, ...MACHINE })).body.link
			.id;
		await as(ALICE).send("patch", `/client/tunnel-links/${id}`, {
			forwardEnabled: false,
		});
		const second = links.mint(ALICE, DEVICE);
		const again = await link(ALICE, {
			token: second.token,
			machineId: "1111",
			machineName: "Laptop 2",
		});
		expect(again.body.link).toMatchObject({
			id,
			deviceName: "Laptop 2",
			forwardEnabled: false,
		});
		expect(links.revoked).toEqual([first.token]);
		expect(await TunnelLinkModel.countDocuments()).toBe(1);
	});

	it("two links racing for one machine leave one row", async () => {
		await TunnelLinkModel.createIndexes();
		const links = useFakeSelfLinks(env.tunelo);
		const first = links.mint(ALICE, DEVICE);
		const second = links.mint(ALICE, DEVICE);
		const answers = await Promise.all([
			link(ALICE, { token: first.token, ...MACHINE }),
			link(ALICE, { token: second.token, ...MACHINE }),
		]);
		expect(answers.map((res) => res.status)).toEqual([200, 200]);
		expect(answers[0]?.body.link.id).toBe(answers[1]?.body.link.id);
		expect(await TunnelLinkModel.countDocuments({ source: "self" })).toBe(1);
	});

	it("tells a pairing token apart from a Tunelo outage", async () => {
		env.tunelo.extend((req, res) => {
			if (req.url !== "/api/links/self") return false;
			res.writeHead(404, { "content-type": "application/json" });
			res.end(JSON.stringify({ error: { code: "TUNELO_LINK_003" } }));
			return true;
		});
		const res = await link(ALICE, { token: "tunelo_pairing", ...MACHINE });
		expect(res.status).toBe(400);
		expect(res.body.error.code).toBe("INVALID_LINK_TOKEN");
	});

	it("counts toward the limit of linked machines", async () => {
		await TunnelLinkModel.insertMany(
			Array.from({ length: MAX_TUNNEL_LINKS }, () => ({
				userSub: ALICE,
				status: "linked",
			})),
		);
		const self = useFakeSelfLinks(env.tunelo).mint(ALICE, DEVICE);
		const res = await link(ALICE, { token: self.token, ...MACHINE });
		expect(res.status).toBe(409);
		expect(res.body.error.code).toBe("TUNNEL_LINK_LIMIT_REACHED");
	});
});

describe("turning a machine's localhost on or off", () => {
	it("works on the user's own machines only", async () => {
		const self = useFakeSelfLinks(env.tunelo).mint(ALICE, DEVICE);
		const id = (await link(ALICE, { token: self.token, ...MACHINE })).body.link
			.id;
		const off = await as(ALICE).send("patch", `/client/tunnel-links/${id}`, {
			forwardEnabled: false,
		});
		expect(off.body.forwardEnabled).toBe(false);
		const bob = await as(BOB).send("patch", `/client/tunnel-links/${id}`, {
			forwardEnabled: true,
		});
		expect(bob.status).toBe(404);
		const pairing = await TunnelLinkModel.create({
			userSub: ALICE,
			status: "linked",
		});
		const res = await as(ALICE).send(
			"patch",
			`/client/tunnel-links/${String(pairing._id)}`,
			{ forwardEnabled: true },
		);
		expect(res.status).toBe(404);
	});
});
