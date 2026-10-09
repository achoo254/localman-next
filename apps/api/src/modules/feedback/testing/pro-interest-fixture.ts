import { afterAll, beforeAll, beforeEach } from "vitest";
import type { RuntimeSettings } from "../../../config/runtime-settings.js";
import { createLogger } from "../../../logger.js";
import { useDashboardTestDb } from "../../../test-support/dashboard-test-app.js";
import { TelegramBotClient } from "../../notifications/channels/telegram-bot-client.js";
import { TelegramChannel } from "../../notifications/channels/telegram-channel.js";
import { setNotificationService } from "../../notifications/notification-runtime.js";
import { NotificationService } from "../../notifications/notification-service.js";
import {
	type FakeBotApi,
	startFakeBotApi,
} from "../../notifications/testing/fake-bot-api.js";
import {
	type FakeTurnstile,
	TURNSTILE_TEST_HOSTNAME,
	startFakeTurnstile,
} from "./fake-turnstile.js";

export const OWNER_CHAT = "4242";
export const SUBMIT = "/feedback/pro-interest";
export const FORM = {
	email: "Nguyen.Van@Gmail.com",
	name: "Nguyễn Văn",
	needs: ["mock", "team"],
	teamSize: "2-5",
	source: "landing",
	consent: true,
};

export interface ProInterestFixture {
	readonly turnstile: FakeTurnstile;
	readonly bot: FakeBotApi;
	/** Waits for background owner alerts, then returns their texts. */
	alerts(): Promise<string[]>;
}

/**
 * TEST ONLY. Mongo, a fake Turnstile and a fake Bot API wired as the
 * owner's alert channel; `settings` override the runtime defaults.
 */
export function useProInterestFixture(
	settings: () => Partial<RuntimeSettings> = () => ({}),
): ProInterestFixture {
	const logger = createLogger("silent");
	let turnstile: FakeTurnstile | undefined;
	let bot: FakeBotApi | undefined;
	let service: NotificationService | undefined;
	beforeAll(async () => {
		turnstile = await startFakeTurnstile();
		bot = await startFakeBotApi();
	});
	afterAll(async () => {
		await turnstile?.close();
		await bot?.close();
	});
	const required = <T>(value: T | undefined): T => {
		if (value === undefined) throw new Error("fixture not started");
		return value;
	};
	useDashboardTestDb(() => ({
		turnstile: {
			siteKey: "site-key",
			secretKey: "secret-key",
			verifyUrl: required(turnstile).url,
			expectedHostname: TURNSTILE_TEST_HOSTNAME,
		},
		...settings(),
	}));
	beforeEach(() => {
		required(turnstile).reset();
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
	});
	return {
		get turnstile() {
			return required(turnstile);
		},
		get bot() {
			return required(bot);
		},
		async alerts() {
			await required(service).drain();
			return required(bot).requests.map((r) => String(r.text));
		},
	};
}
