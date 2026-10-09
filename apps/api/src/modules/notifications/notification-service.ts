import { z } from "zod";
import type { Env } from "../../config/env.js";
import { normalizeInternalPath } from "../../http/internal-path.js";
import type { Logger } from "../../logger.js";
import {
	type NotificationItem,
	type NotificationMessage,
	storeInAppNotification,
} from "./channels/in-app-channel.js";
import { TelegramBotClient } from "./channels/telegram-bot-client.js";
import { TelegramChannel } from "./channels/telegram-channel.js";
import { WebPushChannel } from "./channels/web-push-channel.js";
import { NOTIFICATION_EVENT_TYPES } from "./notification-events.js";
import {
	NOTIFICATION_BODY_MAX,
	NOTIFICATION_TITLE_MAX,
} from "./notification-model.js";
import { channelChoiceFor } from "./notification-preferences-model.js";

const internalLink = z.string().transform((value, ctx) => {
	const path = normalizeInternalPath(value);
	if (path === null) {
		ctx.addIssue({ code: "custom", message: "must be a path on this site" });
		return z.NEVER;
	}
	return path;
});

const notificationMessage = z.object({
	type: z.enum(NOTIFICATION_EVENT_TYPES),
	title: z.string().trim().min(1).max(NOTIFICATION_TITLE_MAX),
	body: z.string().trim().min(1).max(NOTIFICATION_BODY_MAX),
	link: internalLink.optional(),
});

export interface NotificationServiceOptions {
	readonly logger: Logger;
	/** Absent when VAPID keys are not configured. */
	readonly webPush?: WebPushChannel;
	/** Absent when TELEGRAM_BOT_TOKEN is not configured. */
	readonly telegram?: TelegramChannel;
	readonly telegramBotUsername?: string;
	/** Chat of the deployment owner (`OWNER_TELEGRAM_CHAT_ID`) for alerts. */
	readonly ownerChatId?: string;
}

/** Which optional channels this deployment can use at all. */
export interface ChannelAvailability {
	readonly webPush: boolean;
	readonly telegram: boolean;
	readonly telegramBotUsername: string | null;
	readonly vapidPublicKey: string | null;
}

/**
 * Sends a notification to every channel the user chose for its event
 * type. The in-app copy (the bell) is stored before `notify` returns;
 * Web Push and Telegram run in the background so a slow push service or a
 * Telegram backoff never holds the caller's request. Background failures
 * are logged, never rejected.
 */
export class NotificationService {
	private readonly inFlight = new Set<Promise<void>>();

	constructor(private readonly options: NotificationServiceOptions) {}

	get availability(): ChannelAvailability {
		const { webPush, telegram, telegramBotUsername } = this.options;
		return {
			webPush: webPush !== undefined,
			telegram: telegram !== undefined,
			telegramBotUsername: telegram ? (telegramBotUsername ?? null) : null,
			vapidPublicKey: webPush?.publicKey ?? null,
		};
	}

	/** The stored in-app notification, or `null` when the user turned it off. */
	async notify(
		userSub: string,
		event: NotificationMessage,
	): Promise<NotificationItem | null> {
		const message = notificationMessage.parse(event);
		const choice = await channelChoiceFor(userSub, message.type);
		const item = choice.inApp
			? await storeInAppNotification(userSub, message)
			: null;
		const { webPush, telegram } = this.options;
		if (choice.webPush && webPush) {
			this.inBackground(
				webPush.deliver(userSub, {
					id: item?.id ?? null,
					type: message.type,
					title: message.title,
					body: message.body,
					link: message.link ?? null,
				}),
				message.type,
			);
		}
		if (choice.telegram && telegram) {
			this.inBackground(telegram.deliver(userSub, message), message.type);
		}
		return item;
	}

	/**
	 * `notify` without waiting, for callers whose own write already
	 * committed (an invitation must not fail because the bell's store did).
	 * Every failure, the in-app store included, is logged, never thrown.
	 */
	notifyLater(userSub: string, event: NotificationMessage): void {
		this.inBackground(this.notify(userSub, event), event.type);
	}

	/**
	 * Sends a short text to the owner's Telegram chat in the background.
	 * Returns false when the bot or the owner chat is not configured.
	 */
	alertOwner(text: string, type: string): boolean {
		const { telegram, ownerChatId } = this.options;
		if (!telegram || !ownerChatId) return false;
		this.inBackground(telegram.sendToChat(ownerChatId, text), type);
		return true;
	}

	/** Waits for background deliveries (graceful shutdown, tests). */
	async drain(): Promise<void> {
		while (this.inFlight.size > 0) {
			await Promise.all(this.inFlight);
		}
	}

	private inBackground(delivery: Promise<unknown>, type: string): void {
		const tracked: Promise<void> = delivery
			.then(
				() => undefined,
				(error: unknown) => {
					this.options.logger.error(
						{ err: error, type },
						"Notification channel failed",
					);
				},
			)
			.finally(() => {
				this.inFlight.delete(tracked);
			});
		this.inFlight.add(tracked);
	}
}

/** Builds the service with the channels the environment configures. */
export function createNotificationService(
	env: Env,
	logger: Logger,
): NotificationService {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = env;
	const webPush =
		VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
			? new WebPushChannel(
					{
						publicKey: VAPID_PUBLIC_KEY,
						privateKey: VAPID_PRIVATE_KEY,
						subject: VAPID_SUBJECT,
					},
					logger,
				)
			: undefined;
	const telegram = env.TELEGRAM_BOT_TOKEN
		? new TelegramChannel(
				new TelegramBotClient({ token: env.TELEGRAM_BOT_TOKEN, logger }),
				env.PUBLIC_URL,
			)
		: undefined;
	return new NotificationService({
		logger,
		webPush,
		telegram,
		telegramBotUsername: env.TELEGRAM_BOT_USERNAME,
		ownerChatId: env.OWNER_TELEGRAM_CHAT_ID,
	});
}
