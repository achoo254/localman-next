import {
	IconAdjustments,
	IconBell,
	IconChecks,
	IconLoader2,
} from "@tabler/icons-react";
import { Fragment } from "react";
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
import { PanelProgress } from "../../components/ui/panel-progress";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { AccessRequestActions } from "./access-request-actions";
import { NotificationItem } from "./notification-item";
import { NotificationListSkeleton } from "./notification-list-skeleton";
import { type AppNotification, inAppPath } from "./notifications-api";
import { useNotifications } from "./use-notifications";
import { WORKSPACE_EVENT_TYPES } from "./workspace-event-types";

export const NOTIFICATION_SETTINGS_PATH = "/account/notifications";

/** Header bell: unread badge and a menu with the latest notifications. */
export function NotificationBell() {
	const bell = useNotifications();
	const navigate = useNavigate();
	const toast = useToast();
	const t = useT();
	const workspaces = useWorkspacesEnabled();
	const { unreadCount } = bell;
	const items = workspaces
		? bell.items
		: bell.items.filter((item) => !WORKSPACE_EVENT_TYPES.has(item.type));
	const empty = items.length === 0;
	// First page on its way: skeleton rows; with items on screen: a top bar.
	const firstLoad = bell.loading && empty && !bell.error;
	const skeleton = useDelayedFlag(firstLoad);
	const refreshing = bell.loading && !empty;

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
						unreadCount > 0
							? t("notifications.bell.labelUnread", { unread: unreadCount })
							: t("notifications.bell.label")
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
				<DropdownMenuLabel>{t("notifications.bell.heading")}</DropdownMenuLabel>
				<DropdownMenuItem
					data-id="notifications-read-all"
					icon={<IconChecks size={16} aria-hidden="true" />}
					disabled={unreadCount === 0}
					onSelect={(event) => {
						event.preventDefault();
						report(bell.markAllRead());
					}}
				>
					{t("notifications.bell.markAllRead")}
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<PanelProgress
					active={refreshing}
					aria-busy={bell.loading || undefined}
					className="max-h-[60dvh] overflow-y-auto"
				>
					{(skeleton ? [] : items).map((notification) => (
						<Fragment key={notification.id}>
							<NotificationItem
								notification={notification}
								onSelect={(event) => choose(event, notification)}
							/>
							{workspaces && notification.accessRequest ? (
								<AccessRequestActions
									request={notification.accessRequest}
									title={notification.title}
									onChanged={() => void bell.refresh()}
								/>
							) : null}
						</Fragment>
					))}
					{skeleton ? <NotificationListSkeleton /> : null}
					{empty ? (
						<DropdownMenuLabel
							data-id="notifications-empty"
							className={cn(
								bell.error ? "text-error" : null,
								// Screen readers still hear it; the skeleton shows it.
								firstLoad && "sr-only",
							)}
						>
							{t(
								bell.error
									? "notifications.bell.loadFailed"
									: bell.loading
										? "notifications.bell.loading"
										: "notifications.bell.empty",
							)}
						</DropdownMenuLabel>
					) : null}
					{bell.nextCursor ? (
						<DropdownMenuItem
							data-id="notifications-load-more"
							// Not disabled while loading: it keeps focus and full colour.
							aria-busy={bell.loadingMore || undefined}
							icon={
								bell.loadingMore ? (
									<IconLoader2
										size={16}
										aria-hidden="true"
										className="motion-safe:animate-spin"
									/>
								) : undefined
							}
							onSelect={(event) => {
								event.preventDefault();
								if (!bell.loadingMore) void bell.loadMore();
							}}
							className="justify-center"
						>
							{t("notifications.bell.loadMore")}
						</DropdownMenuItem>
					) : null}
				</PanelProgress>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					data-id="notifications-settings-link"
					icon={<IconAdjustments size={16} aria-hidden="true" />}
					onSelect={() => navigate(NOTIFICATION_SETTINGS_PATH)}
				>
					{t("notifications.bell.settings")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
