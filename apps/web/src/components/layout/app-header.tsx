import { Link } from "react-router";
import type { CurrentUser } from "../../features/auth/current-user";
import { NotificationBell } from "../../features/notifications/notification-bell";
import { useT } from "../../i18n/i18n-context";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { Badge } from "../ui/badge";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";

/**
 * Signed-in top bar: wordmark, Docs, language, notification bell, plan
 * and account menu.
 */
export function AppHeader({ user }: { user: CurrentUser }) {
	const t = useT();
	return (
		<header
			data-id="topbar"
			className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 backdrop-blur-md"
		>
			<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter">
				<Link
					to="/projects"
					data-id="topbar-home"
					aria-label={t("layout.appHeader.home")}
					className="rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				<div className="flex items-center gap-2">
					<Link
						to="/docs"
						data-id="topbar-docs"
						className={cn(
							buttonClassName({ variant: "ghost", size: "sm" }),
							"no-underline max-sm:hidden",
						)}
					>
						{t("layout.docs")}
					</Link>
					<div className="max-sm:hidden">
						<LanguageSwitcher data-id="topbar-language" compact />
					</div>
					<NotificationBell />
					<Badge
						data-id="topbar-plan"
						tone={user.plan === "pro" ? "accent" : "neutral"}
						className="max-sm:hidden"
					>
						{t(`layout.plan.${user.plan}`)}
					</Badge>
					<AccountControls user={user} />
				</div>
			</div>
		</header>
	);
}
