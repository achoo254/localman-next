import { Link } from "react-router";
import type { CurrentUser } from "../../features/auth/current-user";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { buttonClassName } from "../ui/button";
import { AccountControls } from "./account-controls";

const OPEN_APP = cn(
	buttonClassName({ variant: "primary", size: "sm" }),
	"no-underline pointer-coarse:min-h-11 max-[479px]:min-h-11",
);

/**
 * What the shared public header shows a signed-in visitor in place of
 * "Sign in": "Open app" and their account menu.
 */
export function PublicAccountSlot({ user }: { user: CurrentUser }) {
	const t = useT();
	return (
		<div data-id="topbar-account-slot" className="flex items-center gap-2">
			<Link to="/projects" data-id="topbar-projects" className={OPEN_APP}>
				{t("common.cta.openApp")}
			</Link>
			<AccountControls user={user} compact />
		</div>
	);
}
