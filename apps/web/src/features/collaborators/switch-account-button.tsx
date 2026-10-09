import { Button, type ButtonVariant } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { useLogout } from "../auth/use-logout";

export interface SwitchAccountButtonProps {
	variant: ButtonVariant;
}

/**
 * Signs out so the invited person can come back with the right account.
 * Logout takes no `returnTo`, so the hint asks them to reopen the link.
 */
export function SwitchAccountButton({ variant }: SwitchAccountButtonProps) {
	const t = useT();
	const session = useLogout("invite-page-logout-form");
	return (
		<div className="grid gap-1">
			<Button
				variant={variant}
				block
				data-id="invite-page-switch-account"
				disabled={session.busy}
				onClick={() => void session.logout()}
			>
				{t(
					session.busy
						? "invite.switchAccount.busy"
						: "invite.switchAccount.action",
				)}
			</Button>
			<p className="m-0 text-center text-muted text-[0.8125rem]">
				{t("invite.switchAccount.hint")}
			</p>
			{session.form}
		</div>
	);
}
