import { DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/cn";
import type { AppNotification } from "./notifications-api";

const TIME_FORMAT = new Intl.DateTimeFormat("vi-VN", {
	dateStyle: "short",
	timeStyle: "short",
});

function formatTime(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? "" : TIME_FORMAT.format(date);
}

export interface NotificationItemProps {
	notification: AppNotification;
	onSelect: (event: Event) => void;
}

/** One bell entry; unread entries carry a dot and a screen-reader label. */
export function NotificationItem({
	notification,
	onSelect,
}: NotificationItemProps) {
	const unread = notification.readAt === null;
	return (
		<DropdownMenuItem
			data-id={`notifications-item-${notification.id}`}
			data-unread={unread}
			onSelect={onSelect}
			className="py-2"
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-2 shrink-0 rounded-full",
					unread ? "bg-primary-solid" : "bg-transparent",
				)}
			/>
			<span className="grid min-w-0 gap-0.5 font-sans">
				<span className={cn("truncate", unread && "font-semibold")}>
					{unread ? <span className="sr-only">Chưa đọc: </span> : null}
					{notification.title}
				</span>
				{notification.body ? (
					<span className="line-clamp-2 text-muted text-xs">
						{notification.body}
					</span>
				) : null}
				<time
					dateTime={notification.createdAt}
					className="font-mono text-muted text-xs"
				>
					{formatTime(notification.createdAt)}
				</time>
			</span>
		</DropdownMenuItem>
	);
}
