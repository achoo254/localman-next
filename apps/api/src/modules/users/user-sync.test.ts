import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	clearCollections,
	connectTestMongo,
} from "../../test-support/test-mongo.js";
import { UserModel } from "./user-model.js";
import { syncUserFromUserInfo } from "./user-sync.js";

const SUB = "acc_sync";
const claims = {
	sub: SUB,
	preferred_username: "dat",
	email: "dat@example.com",
	email_verified: true,
	name: "Đạt",
	picture: "https://cdn.example/a.png",
	telegram_chat_id: "100",
	telegram_username: "dat_tg",
};

let teardownMongo: () => Promise<void>;
beforeAll(async () => {
	teardownMongo = await connectTestMongo();
});
afterAll(async () => {
	await teardownMongo?.();
});
beforeEach(clearCollections);

describe("syncUserFromUserInfo", () => {
	it("creates a user from the claims, without any credential, with its 30 days of Pro", async () => {
		await syncUserFromUserInfo(claims, SUB);
		const user = await UserModel.findOne({ sub: SUB }).lean();
		expect(user).toMatchObject({
			username: "dat",
			email: "dat@example.com",
			emailVerified: true,
			plan: "pro",
			telegram: { chatId: "100", username: "dat_tg" },
		});
		// Only profile, plan and chat: credentials stay at the IdP.
		expect(Object.keys(user ?? {}).sort()).toEqual([
			"_id",
			"createdAt",
			"email",
			"emailVerified",
			"name",
			"picture",
			"plan",
			"planExpiresAt",
			"sub",
			"telegram",
			"trialStartedAt",
			"updatedAt",
			"username",
		]);
	});

	it("follows a relinked or unlinked chat and clears the blocked mark", async () => {
		await syncUserFromUserInfo(claims, SUB);
		await UserModel.updateOne(
			{ sub: SUB },
			{ "telegram.blockedAt": new Date() },
		);
		await syncUserFromUserInfo({ ...claims, telegram_chat_id: "200" }, SUB);
		let user = await UserModel.findOne({ sub: SUB }).lean();
		expect(user?.telegram?.chatId).toBe("200");
		expect(user?.telegram?.blockedAt).toBeUndefined();

		const { telegram_chat_id: _c, telegram_username: _u, ...unlinked } = claims;
		await syncUserFromUserInfo(unlinked, SUB);
		user = await UserModel.findOne({ sub: SUB }).lean();
		expect(user?.telegram?.chatId).toBeUndefined();
		expect(user?.telegram?.username).toBeUndefined();
	});

	it("keeps the plan and the chosen locale, and drops malformed optional claims", async () => {
		await syncUserFromUserInfo(claims, SUB);
		await UserModel.updateOne({ sub: SUB }, { plan: "pro", locale: "vi" });
		await syncUserFromUserInfo(
			{ ...claims, picture: "javascript:alert(1)", email: 42 },
			SUB,
		);
		const user = await UserModel.findOne({ sub: SUB }).lean();
		expect(user?.plan).toBe("pro");
		expect(user?.locale).toBe("vi");
		expect(user?.picture).toBeUndefined();
		expect(user?.email).toBeUndefined();
	});

	it("refuses userinfo for another subject", async () => {
		await expect(syncUserFromUserInfo(claims, "acc_other")).rejects.toThrow(
			/subject mismatch/,
		);
	});
});
