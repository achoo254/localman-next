import { afterAll, beforeAll, beforeEach, vi } from "vitest";
import { createLogger } from "../../../logger.js";
import {
	clearCollections,
	connectTestMongo,
} from "../../../test-support/test-mongo.js";
import { SessionModel } from "../../auth/session-model.js";
import { UserModel } from "../../users/user-model.js";
import { TelegramBotClient } from "../channels/telegram-bot-client.js";
import { TelegramChannel } from "../channels/telegram-channel.js";
import {
	type PushSender,
	WebPushChannel,
} from "../channels/web-push-channel.js";
import { NotificationService } from "../notification-service.js";
import { PushSubscriptionModel } from "../push-subscription-model.js";
import { type FakeBotApi, startFakeBotApi } from "./fake-bot-api.js";

export const USER = "acc_user_1";
/** The live session every test device is registered by. */
export const SESSION_ID = "session-of-user-1";
export const VAPID = {
	publicKey: "BPub",
	privateKey: "priv",
	subject: "mailto:ops@example.com",
};
export const EVENT = {
	type: "project.invitation",
	params: { inviter: "An", project: "Demo", days: 7 },
	link: "/projects/demo",
} as const;
/** `EVENT` rendered for a user who never chose a language. */
export const EVENT_EN = {
	title: "Project collaboration invitation",
	body: 'An invited you to collaborate on the project "Demo". The invitation expires in 7 days.',
} as const;

export interface NotificationTestKit {
	readonly bot: FakeBotApi;
	readonly pushSender: ReturnType<typeof vi.fn<PushSender>>;
	/** Backoff waits requested by the Telegram client (never slept). */
	readonly waits: number[];
	/** A service with both optional channels, wired to the fakes. */
	service(): NotificationService;
	/** `notify` on a fresh service, then waits for its background channels. */
	notifyAndDrain(
		...args: Parameters<NotificationService["notify"]>
	): ReturnType<NotificationService["notify"]>;
	subscribe(endpoint: string): Promise<void>;
}

/**
 * TEST ONLY. Registers the hooks of a notification test file (Mongo, a fake
 * Bot API, a stubbed push sender, a user with a linked Telegram chat) and
 * returns accessors valid inside tests.
 */
export function useNotificationTestKit(): NotificationTestKit {
	const logger = createLogger("silent");
	let teardownMongo: (() => Promise<void>) | undefined;
	let bot: FakeBotApi | undefined;
	let pushSender = vi.fn<PushSender>();
	const waits: number[] = [];

	beforeAll(async () => {
		teardownMongo = await connectTestMongo();
		bot = await startFakeBotApi();
	});
	afterAll(async () => {
		await bot?.close();
		await teardownMongo?.();
	});
	beforeEach(async () => {
		await clearCollections();
		bot?.reset();
		waits.length = 0;
		pushSender = vi.fn<PushSender>().mockResolvedValue({ statusCode: 201 });
		await UserModel.create({
			sub: USER,
			username: "an",
			telegram: { chatId: "777" },
		});
	});

	const requireBot = (): FakeBotApi => {
		if (!bot) throw new Error("fake Bot API not started");
		return bot;
	};
	return {
		get bot() {
			return requireBot();
		},
		get pushSender() {
			return pushSender;
		},
		waits,
		service() {
			const client = new TelegramBotClient({
				token: "123:test-token",
				logger,
				apiBaseUrl: requireBot().url,
				sleep: async (ms) => {
					waits.push(ms);
				},
			});
			return new NotificationService({
				logger,
				webPush: new WebPushChannel(VAPID, logger, (...args) =>
					pushSender(...args),
				),
				telegram: new TelegramChannel(client, "https://localman.test"),
				telegramBotUsername: "localman_bot",
			});
		},
		async notifyAndDrain(...args) {
			const service = this.service();
			const item = await service.notify(...args);
			await service.drain();
			return item;
		},
		async subscribe(endpoint) {
			await SessionModel.updateOne(
				{ _id: SESSION_ID },
				{
					$setOnInsert: {
						sub: USER,
						tokens: "unused",
						accessTokenExpiresAt: new Date(),
						expiresAt: new Date(Date.now() + 60_000),
					},
				},
				{ upsert: true },
			);
			await PushSubscriptionModel.create({
				userSub: USER,
				sessionId: SESSION_ID,
				endpoint,
				keys: { p256dh: "p".repeat(87), auth: "a".repeat(22) },
			});
		},
	};
}
