import { IconBell, IconBellOff } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import type { Translate } from "../../i18n/translate";
import { errorMessage } from "../../lib/api-client";
import { PushPermissionError } from "../../platform/push-support";
import { ChannelRow } from "./channel-row";
import {
	type WebPushStatus,
	WebPushUnavailableError,
	useWebPush,
} from "./use-web-push";

function statusText(
	status: WebPushStatus,
	enabledElsewhere: boolean,
	t: Translate,
): string {
	if (status !== "off") return t(`notifications.webPush.${status}`);
	return t(
		enabledElsewhere
			? "notifications.webPush.elsewhere"
			: "notifications.webPush.off",
	);
}

function failureMessage(error: unknown, t: Translate): string {
	if (error instanceof WebPushUnavailableError) {
		return t("notifications.webPush.unavailable");
	}
	if (error instanceof PushPermissionError) {
		return t(
			error.permission === "denied"
				? "notifications.webPush.blocked"
				: "notifications.webPush.notAllowed",
		);
	}
	return errorMessage(error);
}

export interface WebPushRowProps {
	available: boolean;
	/** The user has a subscription on some device. */
	enabled: boolean;
}

export function WebPushRow({ available, enabled }: WebPushRowProps) {
	const push = useWebPush(available);
	const toast = useToast();
	const t = useT();
	const on = push.status === "on";
	const canEnable = push.status === "off";

	async function toggle() {
		try {
			if (on) {
				await push.disable();
				toast.show({ title: t("notifications.webPush.turnedOff") });
			} else {
				await push.enable();
				toast.show({ title: t("notifications.webPush.turnedOn") });
			}
		} catch (error) {
			toast.show({ tone: "error", title: failureMessage(error, t) });
		}
	}

	return (
		<ChannelRow
			data-id="notify-channel-push"
			statusId="notify-push-status"
			title="Web Push"
			description={statusText(push.status, enabled, t)}
			action={
				<Button
					size="sm"
					data-id={on ? "notify-push-disable" : "notify-push-enable"}
					disabled={push.busy || !(on || canEnable)}
					aria-busy={push.busy || undefined}
					leadingIcon={
						on ? (
							<IconBellOff size={16} aria-hidden="true" />
						) : (
							<IconBell size={16} aria-hidden="true" />
						)
					}
					onClick={() => void toggle()}
				>
					{t(
						on
							? "notifications.webPush.disable"
							: "notifications.webPush.enable",
					)}
				</Button>
			}
		/>
	);
}
