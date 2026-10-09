import {
	IconBell,
	IconBox,
	IconChartBar,
	IconChevronDown,
	IconGauge,
	IconLogout,
	IconUser,
} from "@tabler/icons-react";
import { useRef } from "react";
import { Link, useNavigate } from "react-router";
import {
	type CurrentUser,
	displayName,
} from "../../features/auth/current-user";
import {
	NOTIFICATION_SETTINGS_PATH,
	NotificationBell,
} from "../../features/notifications/notification-bell";
import { releasePushSubscriptionForLogout } from "../../features/notifications/release-push-on-logout";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { logoutUrl } from "../../lib/api-url";
import { idpAccountUrl } from "../../lib/app-config";
import { cn } from "../../lib/cn";
import { openExternal } from "../../platform/navigation";
import { Wordmark } from "../brand/wordmark";
import { Badge } from "../ui/badge";
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

const PLAN_LABEL = { free: "Gói Free", pro: "Gói Pro" } as const;

/** Signed-in top bar: wordmark, notification bell, plan and account menu. */
export function AppHeader({ user }: { user: CurrentUser }) {
	const navigate = useNavigate();
	const logoutForm = useRef<HTMLFormElement>(null);
	const subscription = useSubscriptionDialogs(user.plan);
	const name = displayName(user);

	async function logout() {
		await releasePushSubscriptionForLogout();
		logoutForm.current?.submit();
	}

	return (
		<header
			data-id="topbar"
			className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 backdrop-blur-md"
		>
			<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter">
				<Link
					to="/projects"
					data-id="topbar-home"
					aria-label="Localman — trang chủ"
					className="rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				<div className="flex items-center gap-2">
					<NotificationBell />
					<Badge
						data-id="topbar-plan"
						tone={user.plan === "pro" ? "accent" : "neutral"}
						className="max-sm:hidden"
					>
						{PLAN_LABEL[user.plan]}
					</Badge>
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
								{user.email ? (
									<span className="truncate">{user.email}</span>
								) : null}
								<span>{PLAN_LABEL[user.plan]}</span>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								data-id="account-menu-account"
								icon={<IconGauge size={16} aria-hidden="true" />}
								onSelect={() => navigate("/account")}
							>
								Tài khoản và hạn mức
							</DropdownMenuItem>
							<DropdownMenuItem
								data-id="account-menu-plan"
								icon={<IconBox size={16} aria-hidden="true" />}
								onSelect={() => subscription.openPlans()}
							>
								Quản lý gói
							</DropdownMenuItem>
							<DropdownMenuItem
								data-id="account-menu-notifications"
								icon={<IconBell size={16} aria-hidden="true" />}
								onSelect={() => navigate(NOTIFICATION_SETTINGS_PATH)}
							>
								Thông báo
							</DropdownMenuItem>
							<DropdownMenuItem
								data-id="account-menu-idp"
								icon={<IconUser size={16} aria-hidden="true" />}
								onSelect={() => openExternal(idpAccountUrl)}
							>
								Quản lý tài khoản
							</DropdownMenuItem>
							{user.isOwner ? (
								<DropdownMenuItem
									data-id="account-menu-admin-pro"
									icon={<IconChartBar size={16} aria-hidden="true" />}
									onSelect={() => navigate("/admin/pro-interest")}
								>
									Quản trị · Quan tâm gói Pro
								</DropdownMenuItem>
							) : null}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								data-id="topbar-logout"
								icon={<IconLogout size={16} aria-hidden="true" />}
								onSelect={() => void logout()}
							>
								Đăng xuất
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					{/* Logout is a top-level form POST: the server ends the session
					    (and the IdP session) and answers with a redirect. */}
					<form
						ref={logoutForm}
						method="post"
						action={logoutUrl()}
						data-id="topbar-logout-form"
						hidden
					/>
					{subscription.element}
				</div>
			</div>
		</header>
	);
}
