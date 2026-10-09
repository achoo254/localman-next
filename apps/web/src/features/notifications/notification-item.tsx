import type { Locale } from "@localman/shared/constants";
import { useMemo } from "react";
import { DropdownMenuItem } from "../../components/ui/dropdown-menu";
import { useI18n } from "../../i18n/i18n-context";
import { APP_TIME_ZONE } from "../../i18n/translate";
import { cn } from "../../lib/cn";
import type { AppNotification } from "./notifications-api";

/** Short date and time in the language on screen, in Asia/Saigon. */
function useTimeFormat(locale: Locale): (iso: string) => string {
	return useMemo(() => {
		const format = new Intl.DateTimeFormat(locale, {
			dateStyle: "short",
			timeStyle: "short",
			timeZone: APP_TIME_ZONE,
		});
		return (iso: string) => {
			const date = new Date(iso);
			return Number.isNaN(date.getTime()) ? "" : format.format(date);
		};
	}, [locale]);
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
	const { t, locale } = useI18n();
	const formatTime = useTimeFormat(locale);
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
					{unread ? (
						<span className="sr-only">{`${t("notifications.bell.unread")} `}</span>
					) : null}
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
