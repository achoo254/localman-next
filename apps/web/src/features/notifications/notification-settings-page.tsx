import { useCallback, useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useAppTitle } from "../../lib/use-document-title";
import { useCurrentUser } from "../auth/use-current-user";
import { ChannelRow } from "./channel-row";
import { EventPreferencesTable } from "./event-preferences-table";
import {
	type EventPreference,
	type NotificationPreferences,
	fetchPreferences,
	savePreferences,
} from "./notification-preferences-api";
import { TelegramRow } from "./telegram-row";
import { WebPushRow } from "./web-push-row";

type PreferencesState =
	| { status: "loading" }
	| { status: "ready"; value: NotificationPreferences; version: number }
	| { status: "error"; error: unknown };

/** `/account/notifications`: delivery channels and per-event choices. */
export function NotificationSettingsPage() {
	const t = useT();
	useAppTitle(t("notifications.settings.title"));
	const session = useCurrentUser();
	const toast = useToast();
	const [state, setState] = useState<PreferencesState>({ status: "loading" });

	const load = useCallback(async () => {
		setState({ status: "loading" });
		try {
			setState({
				status: "ready",
				value: await fetchPreferences(),
				version: 0,
			});
		} catch (error) {
			setState({ status: "error", error });
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function save(events: EventPreference[]) {
		try {
			const value = await savePreferences(events);
			setState((s) => ({
				status: "ready",
				value,
				version: s.status === "ready" ? s.version + 1 : 0,
			}));
			toast.show({ title: t("notifications.settings.saved") });
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		}
	}

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
			{state.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					{t("notifications.settings.loading")}
				</output>
			) : null}
			{state.status === "error" ? (
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
			{state.status === "ready" ? (
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
					</section>
					<EventPreferencesTable
						key={state.version}
						events={state.value.events}
						channels={state.value.channels}
						onSave={save}
					/>
				</>
			) : null}
		</article>
	);
}
