import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { resetAutoLoginRedirects } from "../../lib/login-redirect-guard";
import { reloadCurrentUser } from "./use-current-user";

/**
 * `loginLoop`: sign-in was attempted too often without the session
 * sticking (see login-redirect-guard).
 */
type AuthStatusProps =
	| { kind: "loading" | "redirecting" | "loginLoop" }
	| { kind: "error"; error: unknown };

const DATA_IDS = {
	loading: "auth-loading",
	redirecting: "auth-redirecting",
} as const;

/** Full-page placeholder while the session is checked or the IdP loads. */
export function AuthStatus(props: AuthStatusProps) {
	const t = useT();
	if (props.kind === "error" || props.kind === "loginLoop") {
		return (
			<div data-id="auth-error" className="mx-auto grid max-w-md gap-4 py-16">
				<Alert tone="danger" title={t("auth.status.errorTitle")}>
					{props.kind === "error"
						? errorMessage(props.error)
						: t("auth.status.loginLoop")}
				</Alert>
				<Button
					data-id="auth-error-retry"
					onClick={() => {
						resetAutoLoginRedirects();
						void reloadCurrentUser();
					}}
				>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	}
	return (
		<output
			data-id={DATA_IDS[props.kind]}
			className="block py-16 text-center font-mono text-muted text-sm"
		>
			{t(`auth.status.${props.kind}`)}
		</output>
	);
}
