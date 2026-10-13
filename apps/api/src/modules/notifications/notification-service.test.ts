import { pino } from "pino";
import { describe, expect, it } from "vitest";
import webpush from "web-push";
import { runInTenant } from "../../tenancy/tenant-context.js";
import { TEST_TENANT } from "../../test-support/test-tenant.js";
import { SessionModel } from "../auth/session-model.js";
import { UserModel } from "../users/user-model.js";
import { WebPushChannel } from "./channels/web-push-channel.js";
import { NotificationModel } from "./notification-model.js";
import { updateEventPreferences } from "./notification-preferences-model.js";
import { NotificationService } from "./notification-service.js";
import { PushSubscriptionModel } from "./push-subscription-model.js";
import {
	EVENT,
	EVENT_EN,
	USER,
	VAPID,
	useNotificationTestKit,
} from "./testing/notification-test-kit.js";

const kit = useNotificationTestKit();

describe("NotificationService channel routing", () => {
	it("stores the in-app copy only by default", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		const item = await kit.notifyAndDrain(USER, EVENT);
		expect(item).toMatchObject({
			type: EVENT.type,
			link: "/projects/demo",
			readAt: null,
		});
		expect(await NotificationModel.countDocuments({ userSub: USER })).toBe(1);
		expect(kit.pushSender).not.toHaveBeenCalled();
		expect(kit.bot.requests).toHaveLength(0);
	});

	it("adds Web Push to every device and Telegram when the user chose them", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		await kit.subscribe("https://updates.push.services.mozilla.com/wpush/v2/b");
		await updateEventPreferences(USER, [
			{ type: EVENT.type, webPush: true, telegram: true },
		]);
		const item = await kit.notifyAndDrain(USER, EVENT);

		expect(kit.pushSender).toHaveBeenCalledTimes(2);
		const [subscription, payload, options] = kit.pushSender.mock.calls[0] ?? [];
		expect(subscription?.keys.auth).toBe("a".repeat(22));
		expect(JSON.parse(payload ?? "{}")).toEqual({
			id: item?.id,
			type: EVENT.type,
			title: EVENT_EN.title,
			body: EVENT_EN.body,
			link: "/projects/demo",
		});
		expect(options?.vapidDetails).toEqual(VAPID);
		expect(kit.bot.requests).toEqual([
			{
				chat_id: "777",
				text: `${EVENT_EN.title}\n\n${EVENT_EN.body}\n\nhttps://localman.test/projects/demo`,
			},
		]);
	});

	it("only uses the channel chosen for that event", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		await updateEventPreferences(USER, [{ type: EVENT.type, telegram: true }]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.pushSender).not.toHaveBeenCalled();
		expect(kit.bot.requests).toHaveLength(1);
	});

	it("never uses the deployment's Telegram bot for another tenant", async () => {
		const other = { ...TEST_TENANT, id: "ten_AAAAAAAAAAAAAAAA" };
		await runInTenant(other, async () => {
			await UserModel.create({
				sub: USER,
				username: "other",
				telegram: { chatId: "777" },
			});
			await updateEventPreferences(USER, [
				{ type: EVENT.type, telegram: true },
			]);
			expect(kit.service().availability.telegram).toBe(false);
			await kit.notifyAndDrain(USER, EVENT);
		});
		expect(kit.bot.requests).toHaveLength(0);
	});

	it("refuses an event with a link outside the dashboard", async () => {
		await expect(
			kit.service().notify(USER, { ...EVENT, link: "https://evil.example" }),
		).rejects.toThrow();
		expect(await NotificationModel.countDocuments()).toBe(0);
	});
});

describe("Web Push channel", () => {
	it.each([410, 404])(
		"deletes a subscription answered with %i",
		async (status) => {
			await kit.subscribe("https://fcm.googleapis.com/fcm/send/gone");
			await kit.subscribe("https://fcm.googleapis.com/fcm/send/alive");
			kit.pushSender.mockImplementation(async (sub) => {
				if (sub.endpoint.endsWith("/gone")) {
					throw new webpush.WebPushError("gone", status, {}, "", sub.endpoint);
				}
				return { statusCode: 201 };
			});
			await updateEventPreferences(USER, [{ type: EVENT.type, webPush: true }]);
			await kit.notifyAndDrain(USER, EVENT);
			const left = await PushSubscriptionModel.find().lean();
			expect(left.map((s) => s.endpoint)).toEqual([
				"https://fcm.googleapis.com/fcm/send/alive",
			]);
		},
	);

	it("keeps a subscription after a transient failure", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		kit.pushSender.mockRejectedValue(
			new webpush.WebPushError("busy", 503, {}, "", ""),
		);
		await updateEventPreferences(USER, [{ type: EVENT.type, webPush: true }]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(await PushSubscriptionModel.countDocuments()).toBe(1);
	});
});

describe("in-app choice, links and background delivery", () => {
	it("skips the bell when the user turned in-app off for the event", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		await updateEventPreferences(USER, [
			{ type: EVENT.type, inApp: false, webPush: true },
		]);
		expect(await kit.notifyAndDrain(USER, EVENT)).toBeNull();
		expect(await NotificationModel.countDocuments()).toBe(0);
		const payload = JSON.parse(kit.pushSender.mock.calls[0]?.[1] ?? "{}");
		expect(payload.id).toBeNull();
	});

	it("stores the normalized link and refuses dot-segment escapes", async () => {
		const item = await kit.notifyAndDrain(USER, {
			...EVENT,
			link: "/projects/./demo/../demo",
		});
		expect(item?.link).toBe("/projects/demo");
		await expect(
			kit.service().notify(USER, { ...EVENT, link: "/.//evil.com" }),
		).rejects.toThrow();
	});

	it("returns once the in-app copy is stored; Telegram finishes in the background", async () => {
		await updateEventPreferences(USER, [{ type: EVENT.type, telegram: true }]);
		kit.bot.script([{ status: 200, delayMs: 300 }]);
		const service = kit.service();
		const item = await service.notify(USER, EVENT);
		expect(item?.id).toEqual(expect.any(String));
		expect(kit.bot.answered()).toBe(0);
		await service.drain();
		expect(kit.bot.answered()).toBe(1);
	});

	it("logs a failing channel instead of rejecting", async () => {
		const lines: string[] = [];
		const logger = pino({}, { write: (line: string) => lines.push(line) });
		class FailingChannel extends WebPushChannel {
			override async deliver(): Promise<never> {
				throw new Error("push service exploded");
			}
		}
		await updateEventPreferences(USER, [{ type: EVENT.type, webPush: true }]);
		const service = new NotificationService({
			logger,
			webPush: new FailingChannel(VAPID, logger),
		});
		expect(await service.notify(USER, EVENT)).not.toBeNull();
		await service.drain();
		expect(lines.join()).toContain("Notification channel failed");
	});

	it("drops devices whose session has ended instead of pushing to them", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		await SessionModel.updateMany(
			{},
			{ expiresAt: new Date(Date.now() - 1000) },
		);
		await updateEventPreferences(USER, [{ type: EVENT.type, webPush: true }]);
		await kit.notifyAndDrain(USER, EVENT);
		expect(kit.pushSender).not.toHaveBeenCalled();
		expect(await PushSubscriptionModel.countDocuments()).toBe(0);
	});
});
