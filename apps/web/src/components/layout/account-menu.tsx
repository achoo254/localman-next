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

export const PLAN_LABEL = { free: "Gói Free", pro: "Gói Pro" } as const;

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
	const name = displayName(user);
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
					aria-label={`Tài khoản ${name}`}
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
					<span>{PLAN_LABEL[user.plan]}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{item(
					"account-menu-account",
					<IconGauge {...ICON} />,
					"Tài khoản và hạn mức",
					() => navigate("/account"),
				)}
				{item(
					"account-menu-plan",
					<IconBox {...ICON} />,
					"Quản lý gói",
					onManagePlan,
				)}
				{item(
					"account-menu-notifications",
					<IconBell {...ICON} />,
					"Kênh thông báo",
					() => navigate(NOTIFICATION_SETTINGS_PATH),
				)}
				{item(
					"account-menu-docs",
					<IconBook {...ICON} />,
					"Docs",
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
							"Quản trị · Quan tâm gói Pro",
							() => navigate("/admin/pro-interest"),
						)}
						{item(
							"account-menu-admin-feedback",
							<IconInbox {...ICON} />,
							"Quản trị · Hộp thư góp ý",
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
					Đăng xuất
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
