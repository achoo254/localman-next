import type { Logger } from "../../logger.js";
import { readUserLocale } from "../users/user-locale.js";
import { UserModel } from "../users/user-model.js";
import {
	type NotificationMessage,
	storeInAppNotification,
} from "./channels/in-app-channel.js";
import type {
	TelegramChannel,
	TelegramDelivery,
} from "./channels/telegram-channel.js";
import type { WebPushDelivery } from "./channels/web-push-channel.js";
import {
	TEST_NOTIFICATION_TYPE,
	validateEvent,
} from "./notification-events.js";
import type { NotificationService } from "./notification-service.js";
import { renderNotification } from "./notification-texts.js";

/** The test links back to the page it is sent from. */
const SETTINGS_PATH = "/account/notifications";

/**
 * Outcome per channel. `inApp` is always `sent` (a failed store fails the
 * whole request). `webPush` and `telegram` are `skipped` when the channel
 * is not ready: not configured on the server, no subscribed device, no
 * linked chat, or a chat waiting for a relink. `telegram: "blocked"`: the
 * bot got a 403 (Start not pressed), and the chat is marked blocked again
 * as for any notification.
 */
export interface TestNotificationResult {
	readonly inApp: "sent";
	readonly webPush: WebPushDelivery;
	readonly telegram: TelegramDelivery;
}

/** A channel that throws (database, network) counts as failed, logged. */
async function settle<T extends string>(
	delivery: Promise<T>,
	logger: Logger,
	channel: string,
): Promise<T | "failed"> {
	try {
		return await delivery;
	} catch (error) {
		logger.error(
			{ err: error, channel, type: TEST_NOTIFICATION_TYPE },
			"Test notification channel failed",
		);
		return "failed";
	}
}

/**
 * A chat marked blocked is tried again: the user may have pressed Start
 * since the last 403, and the test is how they check. A new 403 marks it
 * blocked again (in `TelegramChannel.deliver`).
 */
async function retryTelegram(
	telegram: TelegramChannel,
	userSub: string,
	message: NotificationMessage,
): Promise<TelegramDelivery> {
	await UserModel.updateOne(
		{ sub: userSub },
		{ $unset: { "telegram.blockedAt": 1 } },
	);
	return telegram.deliver(userSub, message);
}

/**
 * Sends the test notification to the bell and to every ready channel,
 * whatever the user's per-event preferences, in the user's language, and
 * waits for each channel so the caller can tell the user what worked.
 */
export async function deliverTestNotification(
	service: NotificationService,
	userSub: string,
): Promise<TestNotificationResult> {
	const { logger, webPush, telegram } = service.channels;
	const event = validateEvent({
		type: TEST_NOTIFICATION_TYPE,
		params: {},
		link: SETTINGS_PATH,
	});
	const locale = await readUserLocale(userSub);
	const item = await storeInAppNotification(userSub, event, locale);
	const text = renderNotification(event.type, event.params, locale);
	if (!text) throw new Error(`No texts for notification ${event.type}`);
	const message = { ...event, ...text };
	const [pushed, messaged] = await Promise.all([
		webPush
			? settle(
					webPush.deliver(userSub, {
						id: item.id,
						type: message.type,
						title: message.title,
						body: message.body,
						link: message.link ?? null,
					}),
					logger,
					"webPush",
				)
			: ("skipped" as const),
		telegram
			? settle(retryTelegram(telegram, userSub, message), logger, "telegram")
			: ("skipped" as const),
	]);
	return { inApp: "sent", webPush: pushed, telegram: messaged };
}
