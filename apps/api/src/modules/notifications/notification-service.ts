import { DEFAULT_LOCALE, type Locale } from "@localman/shared";
import type { Env } from "../../config/env.js";
import type { Logger } from "../../logger.js";
import { tenantSettings } from "../../tenancy/tenant-settings.js";
import { readOwnerLocale, readUserLocale } from "../users/user-locale.js";
import {
	type NotificationItem,
	storeInAppNotification,
} from "./channels/in-app-channel.js";
import { TelegramBotClient } from "./channels/telegram-bot-client.js";
import { TelegramChannel } from "./channels/telegram-channel.js";
import { WebPushChannel } from "./channels/web-push-channel.js";
import {
	type NotificationEvent,
	validateEvent,
} from "./notification-events.js";
import { channelChoiceFor } from "./notification-preferences-model.js";
import { renderNotification } from "./notification-texts.js";

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
 * type, in the user's language. The in-app copy (the bell) keeps the
 * event's params and is rendered again whenever it is read; it is stored
 * before `notify` returns;
 * Web Push and Telegram run in the background so a slow push service or a
 * Telegram backoff never holds the caller's request. Background failures
 * are logged, never rejected.
 */
export class NotificationService {
	private readonly inFlight = new Set<Promise<void>>();

	constructor(private readonly options: NotificationServiceOptions) {}

	/** The Telegram channel, where the request's tenant may use it. */
	private get telegram(): TelegramChannel | undefined {
		return tenantSettings().telegram ? this.options.telegram : undefined;
	}

	get availability(): ChannelAvailability {
		const { options, telegram } = this;
		const { webPush, telegramBotUsername } = options;
		return {
			webPush: webPush !== undefined,
			telegram: telegram !== undefined,
			telegramBotUsername: telegram ? (telegramBotUsername ?? null) : null,
			vapidPublicKey: webPush?.publicKey ?? null,
		};
	}

	/** The optional channels and the logger, for a delivery that awaits them. */
	get channels(): Pick<
		NotificationServiceOptions,
		"logger" | "webPush" | "telegram"
	> {
		return { ...this.options, telegram: this.telegram };
	}

	/** The stored in-app notification, or `null` when the user turned it off. */
	async notify(
		userSub: string,
		event: NotificationEvent,
	): Promise<NotificationItem | null> {
		const valid = validateEvent(event);
		const [choice, locale] = await Promise.all([
			channelChoiceFor(userSub, event.type),
			readUserLocale(userSub),
		]);
		const item = choice.inApp
			? await storeInAppNotification(userSub, valid, locale)
			: null;
		const { options, telegram } = this;
		const { webPush } = options;
		const text = renderNotification(valid.type, valid.params, locale);
		if (!text) throw new Error(`No texts for notification ${valid.type}`);
		const message = { ...valid, ...text };
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
	notifyLater(userSub: string, event: NotificationEvent): void {
		this.inBackground(this.notify(userSub, event), event.type);
	}

	/**
	 * Sends a short text to the owner's Telegram chat in the background,
	 * written by `text` in the owner's language (`readOwnerLocale`).
	 * Returns false when the bot or the owner chat is not configured.
	 */
	alertOwner(text: (locale: Locale) => string, type: string): boolean {
		const { telegram, ownerChatId } = this.options;
		if (!telegram || !ownerChatId) return false;
		const send = this.ownerLocale(ownerChatId).then((locale) =>
			telegram.sendToChat(ownerChatId, text(locale)),
		);
		this.inBackground(send, type);
		return true;
	}

	/** An alert is never lost to a failed language lookup: English then. */
	private ownerLocale(ownerChatId: string): Promise<Locale> {
		return readOwnerLocale(ownerChatId).catch((error: unknown) => {
			this.options.logger.warn({ err: error }, "Owner locale lookup failed");
			return DEFAULT_LOCALE;
		});
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
