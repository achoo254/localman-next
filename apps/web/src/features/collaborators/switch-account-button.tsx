import { Button, type ButtonVariant } from "../../components/ui/button";
import { useLogout } from "../auth/use-logout";

export interface SwitchAccountButtonProps {
	variant: ButtonVariant;
}

/**
 * Signs out so the invited person can come back with the right account.
 * Logout takes no `returnTo`, so the hint asks them to reopen the link.
 */
export function SwitchAccountButton({ variant }: SwitchAccountButtonProps) {
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
				{session.busy ? "Đang đăng xuất…" : "Đăng nhập tài khoản khác"}
			</Button>
			<p className="m-0 text-center text-muted text-[0.8125rem]">
				Bạn sẽ được đăng xuất. Đăng nhập lại bằng tài khoản được mời rồi mở lại
				link này.
			</p>
			{session.form}
		</div>
	);
}
