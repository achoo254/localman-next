import { useCallback, useEffect, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
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
			toast.show({ title: "Đã lưu tuỳ chọn thông báo." });
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		}
	}

	const telegramUsername =
		session.status === "authenticated" ? session.user.telegram.username : null;

	return (
		<article data-id="notify-settings" className="grid max-w-3xl gap-6">
			<header className="grid gap-2">
				<h1 className="m-0 font-bold text-2xl tracking-[-0.02em]">Thông báo</h1>
				<p className="m-0 text-muted">
					Chọn nơi nhận thông báo cho từng loại sự kiện: chuông trong app, Web
					Push hoặc Telegram.
				</p>
			</header>
			{state.status === "loading" ? (
				<output className="block font-mono text-muted text-sm">
					Đang tải cài đặt…
				</output>
			) : null}
			{state.status === "error" ? (
				<div
					data-id="notify-settings-error"
					className="grid justify-items-start gap-3"
				>
					<Alert tone="danger" title="Không tải được cài đặt thông báo">
						{errorMessage(state.error)}
					</Alert>
					<Button onClick={() => void load()}>Thử lại</Button>
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
							Kênh nhận thông báo
						</h2>
						<ChannelRow
							data-id="notify-channel-inapp"
							statusId="notify-inapp-status"
							title="Trong app"
							description="Chuông trên Localman, chọn theo từng loại sự kiện ở bảng dưới."
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
