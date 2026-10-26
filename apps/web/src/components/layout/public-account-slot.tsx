import type { ReactNode } from "react";
import { Link } from "react-router";
import type { CurrentUser } from "../../features/auth/current-user";
import { LoginLink } from "../../features/auth/login-link";
import type { CurrentUserState } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";
import { AccountTriggerSpacer } from "./account-menu";

/** 44px targets on touch screens and phones, as on the account app (pointer coarse or ≤ 479px). */
export const TAP_TARGET =
	"pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center max-[479px]:inline-flex max-[479px]:min-h-11 max-[479px]:items-center";

const GHOST_SM = cn(
	buttonClassName({ variant: "ghost", size: "sm" }),
	"no-underline",
	TAP_TARGET,
);

const PRIMARY_SM = cn(
	buttonClassName({ variant: "primary", size: "sm" }),
	"no-underline",
	TAP_TARGET,
);

/**
 * One version of the slot. Both versions share one grid cell; the one not
 * in use keeps its room but is hidden from sight, focus and screen readers,
 * and holds look-alike spans instead of links.
 */
function Layer({
	version,
	active,
	children,
}: {
	version: "guest" | "account";
	active: boolean;
	children: ReactNode;
}) {
	return (
		<div
			data-version={version}
			data-layer={active ? "active" : "spacer"}
			aria-hidden={active ? undefined : true}
			inert={!active}
			className={cn(
				"col-start-1 row-start-1 flex items-center gap-2",
				!active && "invisible",
			)}
		>
			{children}
		</div>
	);
}

function GuestPair({ live, returnTo }: { live: boolean; returnTo: string }) {
	const t = useT();
	const signIn = t("layout.publicHeader.signIn");
	// The short label below 640px is part of the long one, so the accessible
	// name of the link still contains the visible text.
	const signUp = (
		<>
			<span className="sm:hidden">{t("common.cta.start")}</span>
			<span className="max-sm:hidden">{t("common.cta.startNow")}</span>
		</>
	);
	if (!live) {
		return (
			<>
				<span className={GHOST_SM}>{signIn}</span>
				<span className={PRIMARY_SM}>{signUp}</span>
			</>
		);
	}
	return (
		<>
			<LoginLink
				returnTo={returnTo}
				data-id="topbar-login"
				className={GHOST_SM}
			>
				{signIn}
			</LoginLink>
			<LoginLink
				returnTo={returnTo}
				prompt="create"
				data-id="topbar-signup"
				aria-label={t("common.cta.startNow")}
				className={PRIMARY_SM}
			>
				{signUp}
			</LoginLink>
		</>
	);
}

function AccountPair({ user }: { user: CurrentUser | null }) {
	const t = useT();
	const openApp = t("common.cta.openApp");
	if (!user) {
		return (
			<>
				<span className={PRIMARY_SM}>{openApp}</span>
				<AccountTriggerSpacer />
			</>
		);
	}
	return (
		<>
			<Link to="/projects" data-id="topbar-projects" className={PRIMARY_SM}>
				{openApp}
			</Link>
			<AccountControls user={user} compact />
		</>
	);
}

export interface PublicAccountSlotProps {
	session: CurrentUserState;
	/** Where sign-in comes back to. */
	returnTo: string;
}

/**
 * Right end of the public top bar: "Sign in" and "Get started" for a guest,
 * "Open app" and the account menu once signed in. Both versions are always
 * laid out on top of each other, so the slot is as wide as the wider one in
 * the current language whatever the session, and the switches and links
 * next to it do not move when the session arrives. While it loads the
 * sign-in pair shows, as on the prerendered pages.
 */
export function PublicAccountSlot({
	session,
	returnTo,
}: PublicAccountSlotProps) {
	const user = session.status === "authenticated" ? session.user : null;
	return (
		<div
			data-id="topbar-account-slot"
			data-view={user ? "account" : "guest"}
			className="grid items-center justify-items-end"
		>
			<Layer version="guest" active={!user}>
				<GuestPair live={!user} returnTo={returnTo} />
			</Layer>
			<Layer version="account" active={user !== null}>
				<AccountPair user={user} />
			</Layer>
		</div>
	);
}
