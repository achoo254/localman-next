import { useSearchParams } from "react-router";
import { Alert } from "../../components/ui/alert";
import { useT } from "../../i18n/i18n-context";
import { en } from "../../i18n/messages/en/dictionary";
import { useTenantInfo } from "../../lib/tenant-info";
import { useHydrated } from "../../lib/use-hydrated";

/** Reasons `/auth/callback` may send back in `?authError=`. */
type AuthErrorCode = keyof typeof en.auth.callbackError;

function isAuthErrorCode(value: string | null): value is AuthErrorCode {
	return value !== null && Object.hasOwn(en.auth.callbackError, value);
}

/**
 * Explains why the last sign-in did not finish; unknown codes are ignored.
 * Shown after hydration: the prerendered landing has no query string.
 */
export function AuthErrorAlert() {
	const [params] = useSearchParams();
	const hydrated = useHydrated();
	const t = useT();
	const idpName = useTenantInfo().displayName;
	const code = params.get("authError");
	if (!hydrated || !isAuthErrorCode(code)) return null;
	return (
		<Alert
			tone="danger"
			title={t(`auth.callbackError.${code}.title`, { idpName })}
			data-id="landing-auth-error"
			className="w-full text-left"
		>
			{t(`auth.callbackError.${code}.text`, { idpName })}
		</Alert>
	);
}
