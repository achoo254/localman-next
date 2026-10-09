import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { errorMessage } from "../../lib/api-client";
import { resetAutoLoginRedirects } from "../../lib/login-redirect-guard";
import { reloadCurrentUser } from "./use-current-user";

type AuthStatusProps =
	| { kind: "loading" | "redirecting" }
	| { kind: "error"; error: unknown };

const MESSAGES = {
	loading: { dataId: "auth-loading", text: "Đang kiểm tra phiên đăng nhập…" },
	redirecting: {
		dataId: "auth-redirecting",
		text: "Đang chuyển tới trang đăng nhập…",
	},
} as const;

/** Full-page placeholder while the session is checked or the IdP loads. */
export function AuthStatus(props: AuthStatusProps) {
	if (props.kind === "error") {
		return (
			<div data-id="auth-error" className="mx-auto grid max-w-md gap-4 py-16">
				<Alert tone="danger" title="Không kiểm tra được phiên đăng nhập">
					{errorMessage(props.error)}
				</Alert>
				<Button
					data-id="auth-error-retry"
					onClick={() => {
						resetAutoLoginRedirects();
						void reloadCurrentUser();
					}}
				>
					Thử lại
				</Button>
			</div>
		);
	}
	const { dataId, text } = MESSAGES[props.kind];
	return (
		<output
			data-id={dataId}
			className="block py-16 text-center font-mono text-muted text-sm"
		>
			{text}
		</output>
	);
}
