import { IconBrandTelegram } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { buttonClassName } from "../../components/ui/button";
import { ExternalLink } from "../../components/ui/external-link";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
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

function statusText(
	{ channel, username }: TelegramRowProps,
	t: Translate,
): string {
	if (!channel.available) return t("notifications.telegram.unavailable");
	if (!channel.linked) return t("notifications.telegram.notLinked");
	if (channel.activated) {
		return username
			? t("notifications.telegram.linkedAs", { username })
			: t("notifications.telegram.linked");
	}
	return username
		? t("notifications.telegram.linkedAsInactive", { username })
		: t("notifications.telegram.linkedInactive");
}

/** Telegram is linked at the IdP; Localman's own bot must then be started. */
export function TelegramRow(props: TelegramRowProps) {
	const t = useT();
	const { channel } = props;
	const botUrl = telegramBotUrl(channel.botUsername);
	const needsStart = channel.available && channel.linked && !channel.activated;

	return (
		<ChannelRow
			data-id="notify-channel-telegram"
			statusId="notify-telegram-status"
			title="Telegram"
			description={statusText(props, t)}
			action={
				channel.available ? (
					<ExternalLink
						href={idpAccountUrl}
						data-id="notify-telegram-link"
						className={cn(buttonClassName({ size: "sm" }), "no-underline")}
					>
						<IconBrandTelegram size={16} aria-hidden="true" />
						{t(
							channel.linked
								? "notifications.telegram.manage"
								: "notifications.telegram.link",
						)}
					</ExternalLink>
				) : null
			}
		>
			{needsStart ? (
				<Alert
					tone="info"
					title={t("notifications.telegram.startTitle")}
					data-id="notify-telegram-start"
				>
					{botUrl
						? renderRich(t("notifications.telegram.startWithBot"), {
								bot: () => (
									<ExternalLink
										href={botUrl}
										data-id="notify-telegram-start-link"
									>
										@{channel.botUsername}
									</ExternalLink>
								),
							})
						: t("notifications.telegram.startNoBot")}
				</Alert>
			) : null}
		</ChannelRow>
	);
}
