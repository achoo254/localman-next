import { SUPPORTED_LOCALES } from "@localman/shared";
import { beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";
import { createLogger } from "../../logger.js";
import { startClearOfRateWindowEdge } from "../../test-support/rate-window-edge.js";
import { UserModel } from "../users/user-model.js";
import { NotificationModel } from "./notification-model.js";
import { updateEventPreferences } from "./notification-preferences-model.js";
import { setNotificationService } from "./notification-runtime.js";
import { NotificationService } from "./notification-service.js";
import { renderNotification } from "./notification-texts.js";
import { deliverTestNotification } from "./test-notification.js";
import {
	USER,
	useNotificationTestKit,
} from "./testing/notification-test-kit.js";
import { as } from "./testing/operations-fixture.js";

const kit = useNotificationTestKit();
const TEST_EN = {
	title: "Test notification",
	body: "If you can read this, Localman's notifications reach you on this channel.",
};

describe("test notification delivery", () => {
	it("reaches the bell, every device and Telegram, and the bell renders it", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result).toEqual({
			inApp: "sent",
			webPush: "sent",
			telegram: "sent",
		});

		const stored = await NotificationModel.find({ userSub: USER }).lean();
		expect(stored).toHaveLength(1);
		expect(stored[0]?.type).toBe("notification.test");
		const page = await as(USER).get("/notifications");
		expect(page.body.items[0]).toMatchObject({
			type: "notification.test",
			...TEST_EN,
			link: "/account/notifications",
			readAt: null,
		});
		const payload = JSON.parse(kit.pushSender.mock.calls[0]?.[1] ?? "{}");
		expect(payload).toEqual({
			id: page.body.items[0].id,
			type: "notification.test",
			...TEST_EN,
			link: "/account/notifications",
		});
		expect(kit.bot.requests).toEqual([
			{
				chat_id: "777",
				text: `${TEST_EN.title}\n\n${TEST_EN.body}\n\nhttps://localman.test/account/notifications`,
			},
		]);
	});

	it("ignores per-event preferences, even with every channel turned off", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		await updateEventPreferences(USER, [
			{
				type: "project.invitation",
				inApp: false,
				webPush: false,
				telegram: false,
			},
			{ type: "usage.quota", inApp: false, webPush: false, telegram: false },
		]);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result).toEqual({
			inApp: "sent",
			webPush: "sent",
			telegram: "sent",
		});
		expect(await NotificationModel.countDocuments({ userSub: USER })).toBe(1);
	});

	it("skips channels that are not ready for the user", async () => {
		await UserModel.updateOne({ sub: USER }, { $unset: { telegram: 1 } });
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result).toEqual({
			inApp: "sent",
			webPush: "skipped",
			telegram: "skipped",
		});
		expect(kit.pushSender).not.toHaveBeenCalled();
		expect(kit.bot.requests).toHaveLength(0);
	});

	it("skips channels the server does not configure", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		const bare = new NotificationService({ logger: createLogger("silent") });
		const result = await deliverTestNotification(bare, USER);
		expect(result).toEqual({
			inApp: "sent",
			webPush: "skipped",
			telegram: "skipped",
		});
	});

	it("reports a refused bot as blocked and marks the chat", async () => {
		kit.bot.script([{ status: 403 }]);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result.telegram).toBe("blocked");
		const user = await UserModel.findOne({ sub: USER }).lean();
		expect(user?.telegram?.blockedAt).toBeInstanceOf(Date);
	});

	it("tries a chat marked blocked again and clears the mark once it is delivered", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ "telegram.blockedAt": new Date() },
		);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result.telegram).toBe("sent");
		expect(kit.bot.requests).toHaveLength(1);
		const user = await UserModel.findOne({ sub: USER }).lean();
		expect(user?.telegram?.blockedAt).toBeUndefined();
	});

	it("marks a chat blocked again when the retry is refused too", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ "telegram.blockedAt": new Date(0) },
		);
		kit.bot.script([{ status: 403 }]);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result.telegram).toBe("blocked");
		const user = await UserModel.findOne({ sub: USER }).lean();
		expect(user?.telegram?.blockedAt?.getTime()).toBeGreaterThan(0);
	});

	it("still skips a chat waiting for a relink at the IdP", async () => {
		await UserModel.updateOne(
			{ sub: USER },
			{ "telegram.refreshPendingAt": new Date() },
		);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result.telegram).toBe("skipped");
		expect(kit.bot.requests).toHaveLength(0);
	});

	it("reports failures of Web Push and Telegram", async () => {
		await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
		kit.pushSender.mockRejectedValue(
			new webpush.WebPushError("busy", 503, {}, "", ""),
		);
		kit.bot.script([{ status: 400 }]);
		const result = await deliverTestNotification(kit.service(), USER);
		expect(result).toEqual({
			inApp: "sent",
			webPush: "failed",
			telegram: "failed",
		});
	});

	it.each(SUPPORTED_LOCALES)("has a title and a body in %s", (locale) => {
		const text = renderNotification("notification.test", undefined, locale);
		expect(text?.title).toBeTruthy();
		expect(text?.body).toBeTruthy();
	});

	it("is written in the user's language", async () => {
		await UserModel.updateOne({ sub: USER }, { locale: "vi" });
		await deliverTestNotification(kit.service(), USER);
		expect(kit.bot.requests[0]?.text).toContain("Thông báo thử");
	});
});

describe("POST /notifications/test", () => {
	beforeEach(() => {
		setNotificationService(kit.service());
	});

	it("returns the outcome per channel, then limits the user to one test a minute", async () => {
		await startClearOfRateWindowEdge(60_000);
		const sent = await as(USER).send("post", "/notifications/test");
		expect(sent.status).toBe(200);
		expect(sent.body).toEqual({
			inApp: "sent",
			webPush: "skipped",
			telegram: "sent",
		});
		const again = await as(USER).send("post", "/notifications/test");
		expect(again.status).toBe(429);
		expect(again.body.error.code).toBe("RATE_LIMITED");
		expect(typeof again.body.error.message).toBe("string");
		expect(await NotificationModel.countDocuments({ userSub: USER })).toBe(1);
		await UserModel.create({ sub: "acc_other", username: "other" });
		expect(
			(await as("acc_other").send("post", "/notifications/test")).status,
		).toBe(200);
	});

	it("keeps the test out of the per-event preferences", async () => {
		const view = await as(USER).get("/notification-preferences");
		expect(
			view.body.events.map((event: { type: string }) => event.type),
		).not.toContain("notification.test");
		const toggle = await as(USER).send("put", "/notification-preferences", {
			events: [{ type: "notification.test", telegram: true }],
		});
		expect(toggle.status).toBe(400);
	});
});
