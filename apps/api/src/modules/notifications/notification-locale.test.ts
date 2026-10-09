import { describe, expect, it } from "vitest";
import { UserModel } from "../users/user-model.js";
import { NotificationModel } from "./notification-model.js";
import { updateEventPreferences } from "./notification-preferences-model.js";
import {
	EVENT,
	EVENT_EN,
	USER,
	useNotificationTestKit,
} from "./testing/notification-test-kit.js";

const kit = useNotificationTestKit();

const VI = {
	title: "Lời mời cộng tác project",
	body: 'An mời bạn cộng tác trong project "Demo". Lời mời hết hạn sau 7 ngày.',
};
const ZH = {
	title: "Project 协作邀请",
	body: "An 邀请你参与 project“Demo”的协作。邀请将在 7 天后过期。",
};

/** Notifies on every channel, returns what each channel received. */
async function deliveredTexts() {
	await kit.subscribe("https://fcm.googleapis.com/fcm/send/a");
	await updateEventPreferences(USER, [
		{ type: EVENT.type, webPush: true, telegram: true },
	]);
	const item = await kit.notifyAndDrain(USER, EVENT);
	const push = JSON.parse(kit.pushSender.mock.calls[0]?.[1] ?? "{}");
	return {
		item: { title: item?.title, body: item?.body },
		push: { title: push.title, body: push.body },
		telegram: String(kit.bot.requests[0]?.text),
	};
}

describe("notifications in the recipient's language", () => {
	it.each([
		["en", EVENT_EN],
		["vi", VI],
		["zh-CN", ZH],
	])("renders in-app, Web Push and Telegram in %s", async (locale, text) => {
		if (locale !== "en") {
			await UserModel.updateOne({ sub: USER }, { $set: { locale } });
		}
		const delivered = await deliveredTexts();
		expect(delivered.item).toEqual(text);
		expect(delivered.push).toEqual(text);
		expect(delivered.telegram).toBe(
			`${text.title}\n\n${text.body}\n\nhttps://localman.test/projects/demo`,
		);
	});

	it("stores the params, never the texts", async () => {
		await kit.notifyAndDrain(USER, EVENT);
		const stored = await NotificationModel.findOne({ userSub: USER }).lean();
		expect(stored?.params).toEqual(EVENT.params);
		expect(stored?.title).toBeUndefined();
		expect(stored?.body).toBeUndefined();
	});

	it("names the project owner in the reader's language when the inviter has no name", async () => {
		await UserModel.updateOne({ sub: USER }, { $set: { locale: "vi" } });
		const item = await kit.notifyAndDrain(USER, {
			...EVENT,
			params: { ...EVENT.params, inviter: null },
		});
		expect(item?.body).toMatch(/^Chủ project mời bạn/);
	});

	it("refuses params that do not fit the event type", async () => {
		await expect(
			kit.service().notify(USER, {
				type: "project.mockUrlChanged",
				params: { project: "  " },
			}),
		).rejects.toThrow();
		expect(await NotificationModel.countDocuments()).toBe(0);
	});
});
