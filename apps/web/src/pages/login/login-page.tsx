import { SignInCard } from "@achoo254/app-shell";
import { Navigate, useSearchParams } from "react-router";
import { SHELL_BRAND } from "../../components/layout/shell-brand";
import { SignUpLegalNote } from "../../features/auth/sign-up-legal-note";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useI18n } from "../../i18n/i18n-context";
import { isSafeReturnPath, loginUrl } from "../../lib/api-url";
import { useDocumentTitle } from "../../lib/use-document-title";
import { navigateToLogin } from "../../platform/navigation";
import { AuthErrorAlert } from "../landing/auth-error-alert";

/** Where sign-in comes back to when `?returnTo=` names no in-app path. */
const DEFAULT_RETURN = "/projects";

/**
 * `/login`: the shared sign-in card of every hoandat.com app, alone in the
 * page. Sign-in comes back to `?returnTo=` (an in-app path) or the
 * projects; a visitor already signed in goes there at once.
 */
export function LoginPage() {
	const { locale, t } = useI18n();
	const [params] = useSearchParams();
	const session = useCurrentUser();
	useDocumentTitle(t("auth.signInPage.title"));
	const asked = params.get("returnTo");
	const returnTo =
		asked !== null && isSafeReturnPath(asked) ? asked : DEFAULT_RETURN;
	if (session.status === "authenticated") {
		return <Navigate to={returnTo} replace />;
	}
	return (
		<SignInCard
			brand={SHELL_BRAND}
			locale={locale}
			signInHref={loginUrl({ returnTo })}
			onSignIn={() => navigateToLogin({ returnTo })}
			title={t("auth.signInPage.title")}
			description={t("auth.signInPage.description")}
		>
			<AuthErrorAlert />
			<SignUpLegalNote data-id="login-legal" />
		</SignInCard>
	);
}
