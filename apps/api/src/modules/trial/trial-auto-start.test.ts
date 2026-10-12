import { describe, expect, it, vi } from "vitest";
import { UserModel } from "../users/user-model.js";
import { syncUserFromUserInfo } from "../users/user-sync.js";
import { DAY_MS, USER, useTrialFixture } from "./testing/trial-fixture.js";
import { autoStartTrial } from "./trial-plan.js";

useTrialFixture();

const stored = () => UserModel.findOne({ sub: USER }).lean();

describe("automatic 30 days of Pro", () => {
	it("start once for an account that never had them", async () => {
		const endsAt = await autoStartTrial(USER);
		expect(endsAt?.toISOString()).toMatch(/T16:59:59\.999Z$/);
		const days = ((endsAt?.getTime() ?? 0) - Date.now()) / DAY_MS;
		expect(days).toBeGreaterThan(29.9);
		expect(days).toBeLessThan(31);
		expect(await stored()).toMatchObject({ plan: "pro" });
		expect(await autoStartTrial(USER)).toBeNull();
	});

	it("never restart once used, even after they ended", async () => {
		await autoStartTrial(USER);
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { planExpiresAt: new Date(Date.now() - 60_000) } },
		);
		expect(await autoStartTrial(USER)).toBeNull();
	});

	it("leave an admin's Pro alone, unlimited or still running", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { plan: "pro", planExpiresAt: null } },
		);
		expect(await autoStartTrial(USER)).toBeNull();
		const later = new Date(Date.now() + 90 * DAY_MS);
		await UserModel.updateOne(
			{ sub: USER },
			{ $set: { planExpiresAt: later } },
		);
		expect(await autoStartTrial(USER)).toBeNull();
		expect((await stored())?.planExpiresAt?.getTime()).toBe(later.getTime());
	});

	it("start at sign-in and session refresh, and only once across both", async () => {
		const claims = { sub: USER, preferred_username: "trial-user" };
		await syncUserFromUserInfo(claims, USER);
		const first = (await stored())?.trialStartedAt?.getTime();
		expect(first).toBeDefined();
		await syncUserFromUserInfo(claims, USER);
		expect((await stored())?.trialStartedAt?.getTime()).toBe(first);
	});

	it("let the sign-in through when the write fails", async () => {
		const failing = vi
			.spyOn(UserModel, "updateOne")
			.mockRejectedValueOnce(new Error("mongo down"));
		await expect(autoStartTrial(USER)).resolves.toBeNull();
		failing.mockRestore();
		expect((await stored())?.trialStartedAt ?? null).toBeNull();
	});
});
