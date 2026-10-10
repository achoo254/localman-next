import type { CurrentUser } from "../../features/auth/current-user";
import { useLogout } from "../../features/auth/use-logout";
import { useSubscriptionDialogs } from "../../features/subscription/use-subscription-dialogs";
import { AccountMenu } from "./account-menu";

/**
 * Account menu of a signed-in user with what it opens: the logout form and
 * the plans / Pro interest dialogs. Used by both top bars.
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
	const subscription = useSubscriptionDialogs(user.plan);
	return (
		<>
			<AccountMenu
				user={user}
				logoutBusy={session.busy}
				onLogout={() => void session.logout()}
				onManagePlan={() => subscription.openPlans()}
				compact={compact}
			/>
			{session.form}
			{subscription.element}
		</>
	);
}
