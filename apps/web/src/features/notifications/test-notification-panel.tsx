import { IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { ApiError, errorMessage } from "../../lib/api-client";
import { ChannelRow } from "./channel-row";
import type { NotificationChannels } from "./notification-preferences-api";
import { announceNotificationsChanged } from "./notifications-changed";
import {
	type TestNotificationResult,
	sendTestNotification,
} from "./test-notification-api";
import { TestNotificationSummary } from "./test-notification-summary";

type TestState =
	| { status: "idle" }
	| { status: "sending" }
	| { status: "done"; result: TestNotificationResult }
	| { status: "error"; error: unknown };

export interface TestNotificationPanelProps {
	channels: NotificationChannels;
	/**
	 * The test reached the Telegram bot (`true`) or the bot was refused
	 * (`false`); the channel's activation follows.
	 */
	onTelegramActivated: (activated: boolean) => void;
}

/** "Send test notification" with the outcome per channel. */
export function TestNotificationPanel({
	channels,
	onTelegramActivated,
}: TestNotificationPanelProps) {
	const t = useT();
	const [state, setState] = useState<TestState>({ status: "idle" });
	const sending = state.status === "sending";

	async function send() {
		setState({ status: "sending" });
		try {
			const result = await sendTestNotification();
			setState({ status: "done", result });
			announceNotificationsChanged();
			if (result.telegram === "sent") onTelegramActivated(true);
			if (result.telegram === "blocked") onTelegramActivated(false);
		} catch (error) {
			setState({ status: "error", error });
		}
	}

	const rateLimited =
		state.status === "error" &&
		state.error instanceof ApiError &&
		state.error.status === 429;

	return (
		<ChannelRow
			data-id="notify-test"
			statusId="notify-test-text"
			title={t("notifications.test.title")}
			description={t("notifications.test.text")}
			action={
				<Button
					size="sm"
					data-id="notify-test-send"
					loading={sending}
					leadingIcon={<IconSend size={16} aria-hidden="true" />}
					onClick={() => void send()}
				>
					{t("notifications.test.send")}
				</Button>
			}
		>
			{state.status === "error" ? (
				<Alert
					tone={rateLimited ? "warning" : "danger"}
					data-id="notify-test-error"
				>
					{rateLimited
						? t("notifications.test.rateLimited")
						: errorMessage(state.error)}
				</Alert>
			) : null}
			{state.status === "done" ? (
				<TestNotificationSummary result={state.result} channels={channels} />
			) : null}
		</ChannelRow>
	);
}
