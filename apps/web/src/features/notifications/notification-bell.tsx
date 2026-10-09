import { IconAdjustments, IconBell, IconChecks } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { NotificationItem } from "./notification-item";
import { type AppNotification, inAppPath } from "./notifications-api";
import { useNotifications } from "./use-notifications";

export const NOTIFICATION_SETTINGS_PATH = "/account/notifications";

/** Header bell: unread badge and a menu with the latest notifications. */
export function NotificationBell() {
	const bell = useNotifications();
	const navigate = useNavigate();
	const toast = useToast();
	const { unreadCount } = bell;

	function report(task: Promise<void>) {
		task.catch((error: unknown) =>
			toast.show({ tone: "error", title: errorMessage(error) }),
		);
	}

	function choose(event: Event, notification: AppNotification) {
		if (notification.readAt === null) report(bell.markRead(notification.id));
		const path = inAppPath(notification.link);
		if (path) navigate(path);
		else event.preventDefault(); // nothing to open: keep the menu open
	}

	return (
		<DropdownMenu onOpenChange={(open) => open && void bell.refresh()}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-id="topbar-bell"
					aria-label={
						unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : "Thông báo"
					}
					className={cn(
						buttonClassName({ variant: "ghost", iconOnly: true }),
						"relative size-9 pointer-coarse:size-11",
					)}
				>
					<IconBell size={20} aria-hidden="true" />
					{unreadCount > 0 ? (
						<span
							aria-hidden="true"
							data-id="topbar-bell-count"
							className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-error px-1 font-bold font-mono text-[0.625rem] text-on-tone"
						>
							{unreadCount > 99 ? "99+" : unreadCount}
						</span>
					) : null}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				data-id="notifications-menu"
				className="w-80 max-w-[calc(100vw-2*var(--gutter))]"
			>
				<DropdownMenuLabel>Thông báo</DropdownMenuLabel>
				<DropdownMenuItem
					data-id="notifications-read-all"
					icon={<IconChecks size={16} aria-hidden="true" />}
					disabled={unreadCount === 0}
					onSelect={(event) => {
						event.preventDefault();
						report(bell.markAllRead());
					}}
				>
					Đánh dấu tất cả đã đọc
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<div className="max-h-[60dvh] overflow-y-auto">
					{bell.items.map((notification) => (
						<NotificationItem
							key={notification.id}
							notification={notification}
							onSelect={(event) => choose(event, notification)}
						/>
					))}
					{bell.items.length === 0 ? (
						<DropdownMenuLabel
							data-id="notifications-empty"
							className={bell.error ? "text-error" : undefined}
						>
							{bell.error
								? "Không tải được thông báo."
								: bell.loading
									? "Đang tải…"
									: "Chưa có thông báo nào."}
						</DropdownMenuLabel>
					) : null}
					{bell.nextCursor ? (
						<DropdownMenuItem
							data-id="notifications-load-more"
							disabled={bell.loading}
							onSelect={(event) => {
								event.preventDefault();
								void bell.loadMore();
							}}
							className="justify-center"
						>
							Xem thêm
						</DropdownMenuItem>
					) : null}
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					data-id="notifications-settings-link"
					icon={<IconAdjustments size={16} aria-hidden="true" />}
					onSelect={() => navigate(NOTIFICATION_SETTINGS_PATH)}
				>
					Cài đặt kênh thông báo
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
