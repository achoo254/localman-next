import { UserModel } from "../../users/user-model.js";
import type { NotificationMessage } from "./in-app-channel.js";
import type {
	TelegramBotClient,
	TelegramSendResult,
} from "./telegram-bot-client.js";

/**
 * `skipped`: no linked chat, the bot was marked as blocked, or the chat
 * is waiting to be re-read after a relink at the IdP.
 */
export type TelegramDelivery = TelegramSendResult | "skipped";

interface StoredTelegram {
	telegram?: {
		chatId?: string | null;
		blockedAt?: Date | null;
		refreshPendingAt?: Date | null;
	} | null;
}

/**
 * Telegram through Localman's own bot. The chat id comes from the IdP
 * (userinfo, `telegram` scope) and is stored on the user. The bot can only
 * write after the user pressed Start in it; a 403 marks the channel as not
 * activated so later notifications skip it until the chat changes or the
 * user saves their Telegram preferences again.
 */
export class TelegramChannel {
	constructor(
		private readonly bot: TelegramBotClient,
		/** Absolute links in messages point at the public dashboard. */
		private readonly publicUrl: string,
	) {}

	async deliver(
		userSub: string,
		message: NotificationMessage,
	): Promise<TelegramDelivery> {
		const user = await UserModel.findOne({ sub: userSub })
			.select("telegram")
			.lean<StoredTelegram>();
		const chatId = user?.telegram?.chatId;
		const telegram = user?.telegram;
		if (!chatId || telegram?.blockedAt || telegram?.refreshPendingAt) {
			return "skipped";
		}

		const result = await this.bot.sendMessage(chatId, this.format(message));
		if (result === "blocked") {
			await UserModel.updateOne(
				{ sub: userSub, "telegram.chatId": chatId },
				{ $set: { "telegram.blockedAt": new Date() } },
			);
		}
		return result;
	}

	private format(message: NotificationMessage): string {
		const lines = [message.title, "", message.body];
		if (message.link)
			lines.push("", new URL(message.link, this.publicUrl).href);
		return lines.join("\n");
	}
}
