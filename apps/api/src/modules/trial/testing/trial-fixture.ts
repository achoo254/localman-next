import type request from "supertest";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { createLogger } from "../../../logger.js";
import {
	as,
	useDashboardTestDb,
} from "../../../test-support/dashboard-test-app.js";
import { TelegramBotClient } from "../../notifications/channels/telegram-bot-client.js";
import { TelegramChannel } from "../../notifications/channels/telegram-channel.js";
import { NotificationModel } from "../../notifications/notification-model.js";
import { setNotificationService } from "../../notifications/notification-runtime.js";
import { NotificationService } from "../../notifications/notification-service.js";
import {
	type FakeBotApi,
	startFakeBotApi,
} from "../../notifications/testing/fake-bot-api.js";
import { UserModel } from "../../users/user-model.js";

export const OWNER = "acc_trial_owner";
export const USER = "acc_trial_user";
export const OWNER_CHAT = "5151";
export const DAY_MS = 24 * 60 * 60 * 1000;

export interface TrialFixture {
	/** Waits for background deliveries, then returns the owner chat texts. */
	ownerAlerts(): Promise<string[]>;
	/** Waits for background deliveries, then returns the bell's types. */
	notificationTypes(sub: string): Promise<string[]>;
}

/**
 * TEST ONLY. Mongo with `OWNER` as the only owner, a user and the owner
 * stored, and a notification service whose Telegram goes to a fake Bot
 * API with `OWNER_CHAT` as the owner alert chat.
 */
export function useTrialFixture(): TrialFixture {
	const logger = createLogger("silent");
	let bot: FakeBotApi | undefined;
	let service: NotificationService | undefined;
	beforeAll(async () => {
		bot = await startFakeBotApi();
	});
	afterAll(async () => {
		await bot?.close();
	});
	useDashboardTestDb(() => ({ ownerSubs: new Set([OWNER]) }));
	const required = <T>(value: T | undefined): T => {
		if (value === undefined) throw new Error("fixture not started");
		return value;
	};
	beforeEach(async () => {
		required(bot).reset();
		const client = new TelegramBotClient({
			token: "1:t",
			logger,
			apiBaseUrl: required(bot).url,
		});
		service = new NotificationService({
			logger,
			telegram: new TelegramChannel(client, "https://localman.test"),
			ownerChatId: OWNER_CHAT,
		});
		setNotificationService(service);
		await UserModel.create([
			{ sub: OWNER, username: "owner" },
			{ sub: USER, username: "learner", name: "Lan Learner" },
		]);
	});
	return {
		async ownerAlerts() {
			await required(service).drain();
			return required(bot)
				.requests.filter((r) => String(r.chat_id) === OWNER_CHAT)
				.map((r) => String(r.text));
		},
		async notificationTypes(sub) {
			await required(service).drain();
			const docs = await NotificationModel.find({ userSub: sub })
				.sort({ _id: 1 })
				.lean<{ type: string }[]>();
			return docs.map((doc) => doc.type);
		},
	};
}

/** The reason `ask` sends by default: stored trimmed, never logged. */
export const REASON = "  Still building the demo for my client  ";

/** `USER` asks for an extension. */
export const ask = (reason = REASON): request.Test =>
	as(USER).send("post", "/users/me/trial/extension", { reason });

/** `USER`'s stored Pro end. */
export async function endsAt(): Promise<Date | null> {
	const user = await UserModel.findOne({ sub: USER }).lean();
	return user?.planExpiresAt ?? null;
}

/** Starts `USER`'s trial, asks for an extension, returns the request id. */
export async function askPending(): Promise<string> {
	await as(USER).send("post", "/users/me/trial");
	expect((await ask()).status).toBe(201);
	const list = await as(OWNER).get("/admin/trial-extensions");
	return String(list.body.items[0]?.id);
}
