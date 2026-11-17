import { describe, expect, it } from "vitest";
import { as, guest } from "../../test-support/dashboard-test-app.js";
import { outboundHeaders } from "../mock-runtime/upstream-forwarder.js";
import { fakeForwardUrl, useFakeSelfLinks } from "./testing/fake-self-links.js";
import { useTuneloTestEnv } from "./testing/tunelo-test-setup.js";
import { TunnelLinkModel, linkTokenSlot } from "./tunelo-link-model.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

/** Alice's own machine, linked by her `tunelo` process. */
async function alicesMachine(): Promise<string> {
	const { token } = useFakeSelfLinks(env.tunelo).mint(ALICE, "tunelo.a");
	const row = await TunnelLinkModel.create({
		userSub: ALICE,
		status: "linked",
		source: "self",
		deviceId: "tunelo.a",
		machineName: "Alice laptop",
		forwardUrl: fakeForwardUrl("tunelo.a"),
		forwardEnabled: true,
	});
	const id = String(row._id);
	await TunnelLinkModel.updateOne(
		{ _id: id },
		{ tokenSealed: env.cipher.encrypt(token, linkTokenSlot(ALICE, id)) },
	);
	return id;
}

const send = (machine?: string) => ({
	method: "GET",
	url: "http://localhost:5173/admin",
	...(machine ? { machine } : {}),
});

describe("only the machine's owner reaches it", () => {
	it("another user naming the machine gets the same 404 as a stranger", async () => {
		const id = await alicesMachine();
		const named = await as(BOB).send("post", "/proxy", send(id));
		expect(named.status).toBe(404);
		expect(named.body.error.code).toBe("MACHINE_NOT_FOUND");
		const made = await as(BOB).send(
			"post",
			"/proxy",
			send("0123456789abcdef01234567"),
		);
		expect(made.body.error.code).toBe(named.body.error.code);
	});

	it("another user's localhost never routes to the owner's machine", async () => {
		await alicesMachine();
		const res = await as(BOB).send("post", "/proxy", send());
		expect(res.status).toBe(403);
		expect(res.body.error.code).toBe("PROXY_TARGET_BLOCKED");
		const machines = await as(BOB).get("/client/machines");
		expect(machines.body.machines).toEqual([]);
		const tunnels = await as(BOB).get("/client/local-tunnels?port=5173");
		expect(tunnels.body.tunnels).toEqual([]);
	});

	it("needs a signed-in caller: guests and public links send nothing", async () => {
		const id = await alicesMachine();
		const res = await guest().send("post", "/proxy", send(id));
		expect(res.status).toBe(401);
		const ports = await guest().get(`/client/machines/${id}/ports`);
		expect(ports.status).toBe(401);
	});

	it("another user cannot list the owner's ports or turn the machine on", async () => {
		const id = await alicesMachine();
		const ports = await as(BOB).get(`/client/machines/${id}/ports`);
		expect(ports.status).toBe(404);
		const toggle = await as(BOB).send("patch", `/client/tunnel-links/${id}`, {
			forwardEnabled: true,
		});
		expect(toggle.status).toBe(404);
	});

	it("a mock's visitor cannot pass a link token on to an upstream", () => {
		expect(
			outboundHeaders([
				{ name: "Tunelo-Access", value: "tunelo_stolen" },
				{ name: "tunelo-local-port", value: "22" },
				{ name: "Host", value: "x" },
				{ name: "Accept", value: "*/*" },
			]),
		).toEqual([{ name: "Accept", value: "*/*" }]);
	});
});
