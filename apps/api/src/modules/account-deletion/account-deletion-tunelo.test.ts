import { beforeEach, describe, expect, it } from "vitest";
import { as } from "../../test-support/dashboard-test-app.js";
import { useTuneloTestEnv } from "../tunelo/testing/tunelo-test-setup.js";
import { TunnelLinkModel } from "../tunelo/tunelo-link-model.js";
import { UserModel } from "../users/user-model.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

/** Links a machine for `sub` through the real pairing flow. */
async function linkMachine(sub: string, device: string): Promise<void> {
	const started = await as(sub).send("post", "/client/tunnel-links");
	expect(started.status).toBe(200);
	expect(env.tunelo.approve(started.body.code, device)).toBe(true);
	const polled = await as(sub).send(
		"post",
		`/client/tunnel-links/${started.body.id}/poll`,
	);
	expect(polled.status).toBe(200);
}

const deleteAlice = () =>
	as(ALICE).send("delete", "/users/me", { confirm: "alice" });

describe("account deletion and linked Tunelo machines", () => {
	it("revokes every linked machine at Tunelo and forgets pairings", async () => {
		await linkMachine(ALICE, "laptop");
		await linkMachine(ALICE, "desktop");
		await as(ALICE).send("post", "/client/tunnel-links");
		await linkMachine(BOB, "bob-laptop");

		const res = await deleteAlice();
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(env.tunelo.revokedTokens).toHaveLength(2);
		expect(await TunnelLinkModel.countDocuments({ userSub: ALICE })).toBe(0);
		expect(await TunnelLinkModel.countDocuments({ userSub: BOB })).toBe(1);
	});

	it("still deletes the rows when Tunelo does not answer", async () => {
		await linkMachine(ALICE, "laptop");
		env.tunelo.setDown(true);
		const res = await deleteAlice();
		expect(res.status, JSON.stringify(res.body)).toBe(200);
		expect(await TunnelLinkModel.countDocuments({ userSub: ALICE })).toBe(0);
		expect(await UserModel.exists({ sub: ALICE })).toBeNull();
	});
});
