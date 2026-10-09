import {
	IconBell,
	IconBook,
	IconBox,
	IconChartBar,
	IconChevronDown,
	IconExternalLink,
	IconGauge,
	IconInbox,
	IconKey,
	IconLogout,
	IconMail,
	IconUser,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import {
	type CurrentUser,
	displayName,
} from "../../features/auth/current-user";
import { NOTIFICATION_SETTINGS_PATH } from "../../features/notifications/notification-bell";
import { idpAccountUrl } from "../../lib/app-config";
import { cn } from "../../lib/cn";
import { openExternal } from "../../platform/navigation";
import { buttonClassName } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { UserAvatar } from "./user-avatar";

export const PLAN_LABEL = { free: "Gói Free", pro: "Gói Pro" } as const;

/**
 * Account pages of the IdP. Email and recovery codes are IdP claims that
 * Localman only syncs at sign-in, so the menu links to them instead of
 * editing them here. The IdP has no email change flow yet; the email entry
 * opens the section that shows it.
 */
const IDP_ENTRIES = [
	{ id: "email", label: "Email", hash: "account-email", Icon: IconMail },
	{
		id: "recovery",
		label: "Mã khôi phục",
		hash: "account-recovery",
		Icon: IconKey,
	},
	{
		id: "idp",
		label: "Mật khẩu và đăng nhập",
		hash: "account-password",
		Icon: IconUser,
	},
] as const;

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
				<DropdownMenuLabel>Tài khoản hoandat · mở tab mới</DropdownMenuLabel>
				{IDP_ENTRIES.map(({ id, label, hash, Icon }) => (
					<DropdownMenuItem
						key={id}
						data-id={`account-menu-${id}`}
						icon={<Icon {...ICON} />}
						onSelect={() => openExternal(`${idpAccountUrl}#${hash}`)}
					>
						{label}
						<span className="sr-only">
							, mở trang tài khoản hoandat ở tab mới
						</span>
						<IconExternalLink
							size={14}
							aria-hidden="true"
							className="ml-auto"
						/>
					</DropdownMenuItem>
				))}
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
