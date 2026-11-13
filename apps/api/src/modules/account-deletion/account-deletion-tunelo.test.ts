import { beforeEach, describe, expect, it } from "vitest";
import { seedCodeLinkedMachine } from "../tunelo/testing/code-linked-machine.js";
import { useTuneloTestEnv } from "../tunelo/testing/tunelo-test-setup.js";
import { TunnelLinkModel } from "../tunelo/tunelo-link-model.js";
import { UserModel } from "../users/user-model.js";
import { deleteAccount } from "./account-deletion-service.js";

const env = useTuneloTestEnv();
const ALICE = "acc_alice";
const BOB = "acc_bob";

beforeEach(async () => {
	await UserModel.create([
		{ sub: ALICE, username: "alice" },
		{ sub: BOB, username: "bob" },
	]);
});

/** A linked machine of `sub` with a live link token at Tunelo. */
async function linkMachine(sub: string, device: string): Promise<void> {
	await seedCodeLinkedMachine(env, sub, device);
}

describe("account deletion and linked Tunelo machines", () => {
	it("revokes every linked machine at Tunelo and forgets leftover rows", async () => {
		await linkMachine(ALICE, "laptop");
		await linkMachine(ALICE, "desktop");
		// A row without a token: nothing to revoke, still deleted.
		await TunnelLinkModel.create({ userSub: ALICE, status: "linked" });
		await linkMachine(BOB, "bob-laptop");

		await deleteAccount(ALICE);
		expect(env.tunelo.revokedTokens).toHaveLength(2);
		expect(await TunnelLinkModel.countDocuments({ userSub: ALICE })).toBe(0);
		expect(await TunnelLinkModel.countDocuments({ userSub: BOB })).toBe(1);
	});

	it("still deletes the rows when Tunelo does not answer", async () => {
		await linkMachine(ALICE, "laptop");
		env.tunelo.setDown(true);
		await deleteAccount(ALICE);
		expect(await TunnelLinkModel.countDocuments({ userSub: ALICE })).toBe(0);
		expect(await UserModel.exists({ sub: ALICE })).toBeNull();
	});
});
