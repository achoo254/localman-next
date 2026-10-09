import { beforeEach, describe, expect, it } from "vitest";
import { UserModel } from "../users/user-model.js";
import { NotificationModel } from "./notification-model.js";
import { updateEventPreferences } from "./notification-preferences-model.js";
import {
	EVENT,
	USER,
	useNotificationTestKit,
} from "./testing/notification-test-kit.js";

const kit = useNotificationTestKit();

describe("Telegram channel", () => {
	beforeEach(async () => {
		await updateEventPreferences(USER, [{ type: EVENT.type, telegram: true }]);
	});

	it("retries after a 429 using retry_after", async () => {
		kit.bot.script([{ status: 429, retryAfter: 3 }, { status: 200 }]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.bot.requests).toHaveLength(2);
		expect(kit.waits).toEqual([3000]);
	});

	it("backs off exponentially without retry_after and stops at the attempt cap", async () => {
		kit.bot.script([
			{ status: 429 },
			{ status: 502 },
			{ status: 429 },
			{ status: 200 },
		]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.waits).toEqual([1000, 2000]);
		expect(kit.bot.requests).toHaveLength(3);
	});

	it("gives up when retry_after exceeds the cap", async () => {
		kit.bot.script([{ status: 429, retryAfter: 120 }, { status: 200 }]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.bot.requests).toHaveLength(1);
		expect(kit.waits).toEqual([]);
	});

	it("marks the channel not activated on 403 and skips it afterwards", async () => {
		kit.bot.script([{ status: 403 }]);
		await kit.notifyAndDrain(USER, EVENT);
		const user = await UserModel.findOne({ sub: USER }).lean();
		expect(user?.telegram?.blockedAt).toBeInstanceOf(Date);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.bot.requests).toHaveLength(1);
		expect(await NotificationModel.countDocuments()).toBe(2);
	});

	it("skips users without a linked chat", async () => {
		await UserModel.updateOne({ sub: USER }, { $unset: { telegram: 1 } });
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.bot.requests).toHaveLength(0);
	});

	it("pauses while a relink at the IdP waits for userinfo", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ "telegram.refreshPendingAt": new Date() },
		);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.bot.requests).toHaveLength(0);
	});
});
