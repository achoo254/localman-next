import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { createLogger } from "../../logger.js";
import { EVE, VIC, notificationsOf } from "../access/testing/access-fixture.js";
import { SessionModel } from "../auth/session-model.js";
import { useCollectionTestDb } from "../collections/testing/collection-fixture.js";
import { TelegramBotClient } from "../notifications/channels/telegram-bot-client.js";
import { TelegramChannel } from "../notifications/channels/telegram-channel.js";
import {
	type PushSender,
	WebPushChannel,
} from "../notifications/channels/web-push-channel.js";
import { updateEventPreferences } from "../notifications/notification-preferences-model.js";
import { setNotificationService } from "../notifications/notification-runtime.js";
import { NotificationService } from "../notifications/notification-service.js";
import { PushSubscriptionModel } from "../notifications/push-subscription-model.js";
import {
	type FakeBotApi,
	startFakeBotApi,
} from "../notifications/testing/fake-bot-api.js";
import { UserModel } from "../users/user-model.js";
import { comment, setup } from "./testing/comment-fixture.js";

useCollectionTestDb();

const logger = createLogger("silent");
const pushSender = vi.fn<PushSender>();
let bot: FakeBotApi | undefined;
let service: NotificationService;

beforeAll(async () => {
	bot = await startFakeBotApi();
});
afterAll(async () => {
	await bot?.close();
});
beforeEach(async () => {
	bot?.reset();
	pushSender.mockReset().mockResolvedValue({ statusCode: 201 });
	service = new NotificationService({
		logger,
		webPush: new WebPushChannel(
			{ publicKey: "BPub", privateKey: "priv", subject: "mailto:a@b.c" },
			logger,
			(...args) => pushSender(...args),
		),
		telegram: new TelegramChannel(
			new TelegramBotClient({
				token: "1:t",
				logger,
				apiBaseUrl: bot?.url ?? "",
			}),
			"https://localman.test",
		),
	});
	setNotificationService(service);
	await UserModel.updateOne(
		{ sub: EVE },
		{ $set: { "telegram.chatId": "42" } },
	);
	await SessionModel.create({
		_id: "session-eve",
		sub: EVE,
		tokens: "unused",
		accessTokenExpiresAt: new Date(),
		expiresAt: new Date(Date.now() + 60_000),
	});
	await PushSubscriptionModel.create({
		userSub: EVE,
		sessionId: "session-eve",
		endpoint: "https://fcm.googleapis.com/fcm/send/eve",
		keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
	});
});

describe("@mention delivery follows the mentioned person's channels", () => {
	it("sends the mention by Web Push and Telegram, with the comment link, when chosen", async () => {
		await updateEventPreferences(EVE, [
			{ type: "comment.mentioned", webPush: true, telegram: true },
		]);
		const { id, nodeId } = await setup();
		const res = await comment(VIC, id, { nodeId, body: "@eve look" });
		expect(res.status).toBe(201);
		await service.drain();

		const [mention] = await notificationsOf(EVE);
		expect(mention?.type).toBe("comment.mentioned");
		const link = `/elements/collection/${id}?node=${nodeId}&comment=${res.body.id}`;
		expect(mention?.link).toBe(link);

		expect(pushSender).toHaveBeenCalledTimes(1);
		const [subscription, payload] = pushSender.mock.calls[0] ?? [];
		expect(subscription?.endpoint).toBe(
			"https://fcm.googleapis.com/fcm/send/eve",
		);
		expect(JSON.parse(String(payload))).toMatchObject({
			type: "comment.mentioned",
			link,
		});

		expect(bot?.requests).toHaveLength(1);
		expect(bot?.requests[0]?.chat_id).toBe("42");
		expect(String(bot?.requests[0]?.text)).toContain(
			`https://localman.test${link}`,
		);
	});

	it("keeps a mention in-app only when the person chose no other channel", async () => {
		const { id, nodeId } = await setup();
		const res = await comment(VIC, id, { nodeId, body: "@eve look" });
		expect(res.status).toBe(201);
		await service.drain();

		expect((await notificationsOf(EVE)).map((item) => item.type)).toEqual([
			"comment.mentioned",
		]);
		expect(pushSender).not.toHaveBeenCalled();
		expect(bot?.requests).toHaveLength(0);
	});
});
