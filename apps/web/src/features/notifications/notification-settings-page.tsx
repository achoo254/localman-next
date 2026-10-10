import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { useCurrentUser } from "../auth/use-current-user";
import { ChannelRow } from "./channel-row";
import { EventPreferencesTable } from "./event-preferences-table";
import { NotificationSettingsSkeleton } from "./notification-settings-skeleton";
import { TelegramRow } from "./telegram-row";
import { TestNotificationPanel } from "./test-notification-panel";
import { useNotificationPreferences } from "./use-notification-preferences";
import { WebPushRow } from "./web-push-row";

/** `/account/notifications`: delivery channels and per-event choices. */
export function NotificationSettingsPage() {
	const t = useT();
	useAppTitle(t("notifications.settings.title"));
	const session = useCurrentUser();
	const { state, load, toggleEvent, setTelegramActivated } =
		useNotificationPreferences();
	// Held its minimum time even when the preferences come back sooner.
	const skeleton = useDelayedFlag(state.status === "loading");

	const telegramUsername =
		session.status === "authenticated" ? session.user.telegram.username : null;

	return (
		<article data-id="notify-settings" className="grid max-w-3xl gap-6">
			<header className="grid gap-2">
				<h1 className="m-0 font-bold text-2xl tracking-[-0.02em]">
					{t("notifications.settings.title")}
				</h1>
				<p className="m-0 text-muted">{t("notifications.settings.lead")}</p>
			</header>
			{skeleton ? <NotificationSettingsSkeleton /> : null}
			{state.status === "error" && !skeleton ? (
				<div
					data-id="notify-settings-error"
					className="grid justify-items-start gap-3"
				>
					<Alert tone="danger" title={t("notifications.settings.loadFailed")}>
						{errorMessage(state.error)}
					</Alert>
					<Button onClick={() => void load()}>{t("common.cta.retry")}</Button>
				</div>
			) : null}
			{state.status === "ready" && !skeleton ? (
				<>
					<section
						data-id="notify-channels"
						aria-labelledby="notify-channels-title"
						className={cn(cardClassName, "grid p-6 pb-3")}
					>
						<h2
							id="notify-channels-title"
							className="m-0 mb-3 font-bold font-mono text-base"
						>
							{t("notifications.settings.channelsTitle")}
						</h2>
						<ChannelRow
							data-id="notify-channel-inapp"
							statusId="notify-inapp-status"
							title={t("notifications.channels.inApp")}
							description={t("notifications.settings.inAppText")}
						/>
						<WebPushRow {...state.value.channels.webPush} />
						<TelegramRow
							channel={state.value.channels.telegram}
							username={telegramUsername}
						/>
						<TestNotificationPanel
							channels={state.value.channels}
							onTelegramActivated={setTelegramActivated}
						/>
					</section>
					<EventPreferencesTable
						events={state.value.events}
						channels={state.value.channels}
						onToggle={(type, channel, value) =>
							void toggleEvent(type, channel, value)
						}
					/>
				</>
			) : null}
		</article>
	);
}
