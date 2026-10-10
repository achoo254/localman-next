import type { ReactNode } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge, type BadgeTone } from "../../components/ui/badge";
import { ExternalLink } from "../../components/ui/external-link";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
import {
	type NotificationChannels,
	telegramBotUrl,
} from "./notification-preferences-api";
import type { TestNotificationResult } from "./test-notification-api";

type Outcome = "sent" | "notSetUp" | "unavailable" | "failed" | "blocked";
type Channel = keyof TestNotificationResult;

const TONES: Readonly<Record<Outcome, BadgeTone>> = {
	sent: "success",
	notSetUp: "neutral",
	unavailable: "neutral",
	failed: "danger",
	blocked: "warning",
};

const skipped = (available: boolean): Outcome =>
	available ? "notSetUp" : "unavailable";

/** What to show per channel, in display order. */
function outcomes(
	result: TestNotificationResult,
	channels: NotificationChannels,
): { channel: Channel; outcome: Outcome }[] {
	const { webPush, telegram } = result;
	return [
		{ channel: "inApp", outcome: "sent" },
		{
			channel: "webPush",
			outcome:
				webPush === "skipped" ? skipped(channels.webPush.available) : webPush,
		},
		{
			channel: "telegram",
			outcome:
				telegram === "skipped"
					? skipped(channels.telegram.available)
					: telegram,
		},
	];
}

function hint(
	channel: Channel,
	outcome: Outcome,
	botUsername: string | null,
	t: Translate,
): ReactNode {
	if (channel === "inApp") return t("notifications.test.inAppHint");
	if (outcome === "failed") return t("notifications.test.failedHint");
	if (outcome !== "blocked") return null;
	const botUrl = telegramBotUrl(botUsername);
	if (!botUrl) return t("notifications.test.blockedNoBot");
	return renderRich(t("notifications.test.blockedWithBot"), {
		bot: () => (
			<ExternalLink href={botUrl} data-id="notify-test-bot-link">
				@{botUsername}
			</ExternalLink>
		),
	});
}

export interface TestNotificationSummaryProps {
	result: TestNotificationResult;
	channels: NotificationChannels;
}

/** Outcome of a test per channel, with what to do next where it helps. */
export function TestNotificationSummary({
	result,
	channels,
}: TestNotificationSummaryProps) {
	const t = useT();
	return (
		<Alert
			tone="info"
			title={t("notifications.test.resultTitle")}
			data-id="notify-test-result"
		>
			<ul className="m-0 mt-2 grid list-none gap-2 p-0">
				{outcomes(result, channels).map(({ channel, outcome }) => {
					const note = hint(channel, outcome, channels.telegram.botUsername, t);
					return (
						<li
							key={channel}
							data-id={`notify-test-${channel}`}
							className="grid gap-1"
						>
							<span className="flex flex-wrap items-center gap-2">
								<span className="font-mono font-semibold text-sm">
									{t(`notifications.channels.${channel}`)}
								</span>
								<Badge tone={TONES[outcome]}>
									{t(`notifications.test.status.${outcome}`)}
								</Badge>
							</span>
							{note ? (
								<span className="text-[0.8125rem] text-muted">{note}</span>
							) : null}
						</li>
					);
				})}
			</ul>
		</Alert>
	);
}
