import { IconBrandTelegram } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { buttonClassName } from "../../components/ui/button";
import { ExternalLink } from "../../components/ui/external-link";
import { idpAccountUrl } from "../../lib/app-config";
import { cn } from "../../lib/cn";
import { ChannelRow } from "./channel-row";
import {
	type NotificationChannels,
	telegramBotUrl,
} from "./notification-preferences-api";

export interface TelegramRowProps {
	channel: NotificationChannels["telegram"];
	/** Linked Telegram username from the session, without "@". */
	username: string | null;
}

function statusText({ channel, username }: TelegramRowProps): string {
	if (!channel.available) return "Máy chủ chưa bật Telegram.";
	if (!channel.linked) {
		return "Chưa liên kết. Liên kết ở tài khoản hoandat, dùng chung cho Localman và Tunelo.";
	}
	const who = username ? ` @${username}` : "";
	return channel.activated
		? `Đã liên kết${who}.`
		: `Đã liên kết${who}, chưa kích hoạt bot.`;
}

/** Telegram is linked at the IdP; Localman's own bot must then be started. */
export function TelegramRow(props: TelegramRowProps) {
	const { channel } = props;
	const botUrl = telegramBotUrl(channel.botUsername);
	const needsStart = channel.available && channel.linked && !channel.activated;

	return (
		<ChannelRow
			data-id="notify-channel-telegram"
			statusId="notify-telegram-status"
			title="Telegram"
			description={statusText(props)}
			action={
				channel.available ? (
					<ExternalLink
						href={idpAccountUrl}
						data-id="notify-telegram-link"
						className={cn(buttonClassName({ size: "sm" }), "no-underline")}
					>
						<IconBrandTelegram size={16} aria-hidden="true" />
						{channel.linked ? "Quản lý" : "Liên kết Telegram"}
					</ExternalLink>
				) : null
			}
		>
			{needsStart ? (
				<Alert
					tone="info"
					title="Kích hoạt bot Telegram"
					data-id="notify-telegram-start"
				>
					{botUrl ? (
						<>
							Mở{" "}
							<ExternalLink href={botUrl} data-id="notify-telegram-start-link">
								@{channel.botUsername}
							</ExternalLink>{" "}
							và bấm Start để Localman gửi được thông báo cho bạn.
						</>
					) : (
						"Mở bot Telegram của Localman và bấm Start để nhận thông báo."
					)}
				</Alert>
			) : null}
		</ChannelRow>
	);
}
