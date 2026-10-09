import {
	IconBell,
	IconBook,
	IconBox,
	IconChartBar,
	IconChevronDown,
	IconGauge,
	IconInbox,
	IconLogout,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { useFeatures } from "../../config/features";
import {
	type CurrentUser,
	displayName,
} from "../../features/auth/current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { buttonClassName } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { IdpAccountItems } from "./idp-account-items";
import { UserAvatar } from "./user-avatar";

const ICON = { size: 16, "aria-hidden": true } as const;

export interface AccountMenuProps {
	user: CurrentUser;
	logoutBusy: boolean;
	onLogout: () => void;
	onManagePlan: () => void;
}

/** Avatar button and the account menu of the signed-in top bar. */
export function AccountMenu({
	user,
	logoutBusy,
	onLogout,
	onManagePlan,
}: AccountMenuProps) {
	const navigate = useNavigate();
	const flags = useFeatures();
	const t = useT();
	const name = displayName(user, t("auth.accountFallback"));
	const item = (
		dataId: string,
		icon: ReactNode,
		label: ReactNode,
		onSelect: () => void,
		className?: string,
	) => (
		<DropdownMenuItem
			data-id={dataId}
			icon={icon}
			onSelect={onSelect}
			className={className}
		>
			{label}
		</DropdownMenuItem>
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-id="topbar-account"
					aria-label={t("layout.accountMenu.trigger", { name })}
					className={cn(buttonClassName({ variant: "ghost" }), "px-2")}
				>
					<UserAvatar user={user} />
					<span className="max-w-48 truncate font-mono text-[0.8125rem] text-muted max-sm:hidden">
						{name}
					</span>
					<IconChevronDown size={16} aria-hidden="true" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent data-id="account-menu">
				<DropdownMenuLabel className="grid gap-0.5">
					<span className="truncate font-semibold text-fg">{name}</span>
					{user.email ? <span className="truncate">{user.email}</span> : null}
					<span>{t(`layout.plan.${user.plan}`)}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{item(
					"account-menu-account",
					<IconGauge {...ICON} />,
					t("layout.accountMenu.account"),
					() => navigate("/account"),
				)}
				{item(
					"account-menu-plan",
					<IconBox {...ICON} />,
					t("layout.accountMenu.plan"),
					onManagePlan,
				)}
				{item(
					"account-menu-notifications",
					<IconBell {...ICON} />,
					t("layout.accountMenu.notifications"),
					() => navigate(NOTIFICATION_SETTINGS_PATH),
				)}
				{item(
					"account-menu-docs",
					<IconBook {...ICON} />,
					t("layout.docs"),
					() => navigate("/docs"),
					"sm:hidden",
				)}
				<DropdownMenuSeparator />
				<IdpAccountItems withApps={flags.mockMcp} />
				{user.isOwner ? (
					<>
						<DropdownMenuSeparator />
						{item(
							"account-menu-admin-pro",
							<IconChartBar {...ICON} />,
							t("layout.accountMenu.adminProInterest"),
							() => navigate("/admin/pro-interest"),
						)}
						{item(
							"account-menu-admin-feedback",
							<IconInbox {...ICON} />,
							t("layout.accountMenu.adminFeedback"),
							() => navigate("/admin/feedback"),
						)}
					</>
				) : null}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					data-id="topbar-logout"
					icon={<IconLogout {...ICON} />}
					disabled={logoutBusy}
					onSelect={onLogout}
				>
					{t("layout.accountMenu.signOut")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
