import type { CurrentUser } from "../../features/auth/current-user";
import { useLogout } from "../../features/auth/use-logout";
import { AccountMenu } from "./account-menu";

/**
 * Account menu of a signed-in user with the logout form it submits. Used
 * by both top bars.
 */
export function AccountControls({
	user,
	compact = false,
}: {
	user: CurrentUser;
	/** Avatar-only trigger (see `AccountMenu`). */
	compact?: boolean;
}) {
	const session = useLogout("topbar-logout-form");
	return (
		<>
			<AccountMenu
				user={user}
				logoutBusy={session.busy}
				onLogout={() => void session.logout()}
				compact={compact}
			/>
			{session.form}
		</>
	);
}
