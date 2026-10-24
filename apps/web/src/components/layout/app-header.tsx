import { Link, NavLink, useLocation } from "react-router";
import { useFeatures } from "../../config/features";
import type { CurrentUser } from "../../features/auth/current-user";
import { NotificationBell } from "../../features/notifications/notification-bell";
import { useSecretVaultEnabled } from "../../features/secure-vault/use-secret-vault-enabled";
import { VaultHeaderButton } from "../../features/secure-vault/vault-header-button";
import {
	WorkspaceSwitcher,
	isWorkspaceRoute,
} from "../../features/workspaces/workspace-switcher";
import { useT } from "../../i18n/i18n-context";
import { LanguageSwitcher } from "../../i18n/language-switcher";
import { cn } from "../../lib/cn";
import { Wordmark } from "../brand/wordmark";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";

const NAV_LINK_CLASS = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"no-underline aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary",
);

/**
 * Signed-in top bar: wordmark and the product nav (Mock API, API Client
 * behind its flag) and, on API client pages, the workspace switcher on the
 * left; Docs, language, the secret vault lock (behind its flag),
 * notification bell and account menu on the right. `wide` spans the full width (the workbench).
 */
export function AppHeader({
	user,
	wide = false,
}: { user: CurrentUser; wide?: boolean }) {
	const t = useT();
	const { apiClient } = useFeatures();
	const vault = useSecretVaultEnabled();
	// Workspace settings and shared elements belong to the API client too.
	const apiClientActive = isWorkspaceRoute(useLocation().pathname);
	return (
		<header
			data-id="topbar"
			className="sticky top-0 z-30 border-border-subtle border-b bg-bg/82 backdrop-blur-md"
		>
			<div
				className={cn(
					"mx-auto flex min-h-(--topbar-h) w-full items-center gap-3",
					wide ? "px-3" : "max-w-page px-gutter",
				)}
			>
				<Link
					to="/projects"
					data-id="topbar-home"
					aria-label={t("layout.appHeader.home")}
					className="rounded-sm no-underline"
				>
					<Wordmark />
				</Link>
				<nav
					aria-label={t("layout.appHeader.nav")}
					className="flex gap-0.5 max-sm:hidden"
				>
					<NavLink
						to="/projects"
						data-id="topbar-nav-mock-api"
						className={NAV_LINK_CLASS}
					>
						{t("layout.appHeader.mocks")}
					</NavLink>
					{apiClient ? (
						<Link
							to="/api-client"
							data-id="topbar-nav-api-client"
							aria-current={apiClientActive ? "page" : undefined}
							className={NAV_LINK_CLASS}
						>
							{t("apiClient.nav")}
						</Link>
					) : null}
				</nav>
				<WorkspaceSwitcher />
				<div className="ml-auto flex items-center gap-2">
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
					{vault ? <VaultHeaderButton /> : null}
					<NotificationBell />
					<AccountControls user={user} />
				</div>
			</div>
		</header>
	);
}
