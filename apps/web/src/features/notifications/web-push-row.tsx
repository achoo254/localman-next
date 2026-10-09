import { IconBell, IconBellOff } from "@tabler/icons-react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import { PushPermissionError } from "../../platform/push-support";
import { ChannelRow } from "./channel-row";
import {
	type WebPushStatus,
	WebPushUnavailableError,
	useWebPush,
} from "./use-web-push";

function statusText(status: WebPushStatus, enabledElsewhere: boolean): string {
	switch (status) {
		case "checking":
			return "Đang kiểm tra trình duyệt…";
		case "unsupported":
			return "Trình duyệt không hỗ trợ Web Push.";
		case "unavailable":
			return "Máy chủ chưa bật Web Push.";
		case "denied":
			return "Trình duyệt đang chặn. Mở cài đặt trang để cho phép.";
		case "on":
			return "Đã bật trên trình duyệt này.";
		default:
			return enabledElsewhere
				? "Đang bật trên thiết bị khác, chưa bật trên trình duyệt này."
				: "Chưa bật.";
	}
}

function failureMessage(error: unknown): string {
	if (error instanceof WebPushUnavailableError) {
		return "Máy chủ chưa bật Web Push.";
	}
	if (error instanceof PushPermissionError) {
		return error.permission === "denied"
			? "Trình duyệt đang chặn thông báo của Localman."
			: "Bạn chưa cho phép thông báo.";
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
	const on = push.status === "on";
	const canEnable = push.status === "off";

	async function toggle() {
		try {
			if (on) {
				await push.disable();
				toast.show({ title: "Đã tắt Web Push trên trình duyệt này." });
			} else {
				await push.enable();
				toast.show({ title: "Đã bật Web Push trên trình duyệt này." });
			}
		} catch (error) {
			toast.show({ tone: "error", title: failureMessage(error) });
		}
	}

	return (
		<ChannelRow
			data-id="notify-channel-push"
			statusId="notify-push-status"
			title="Web Push"
			description={statusText(push.status, enabled)}
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
					{on ? "Tắt Web Push" : "Bật Web Push"}
				</Button>
			}
		/>
	);
}
