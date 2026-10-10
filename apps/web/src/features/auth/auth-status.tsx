import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { resetAutoLoginRedirects } from "../../lib/login-redirect-guard";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { reloadCurrentUser } from "./use-current-user";

/**
 * `loginLoop`: sign-in was attempted too often without the session
 * sticking (see login-redirect-guard).
 */
type AuthStatusProps =
	| { kind: "loading" | "redirecting" | "loginLoop" }
	| { kind: "error"; error: unknown };

/**
 * The session is being checked: after 150 ms, a page-shaped skeleton
 * (title, lead, two cards) that says "Checking your session…" once.
 */
function SessionLoading() {
	const t = useT();
	const shown = useDelayedFlag(true);
	if (!shown) return null;
	return (
		<SkeletonRegion
			data-id="auth-loading"
			label={t("auth.status.loading")}
			className="grid gap-5"
		>
			<Skeleton className="h-8 w-48 max-w-full" />
			<Skeleton variant="text" lines={2} className="max-w-md" />
			{[0, 1].map((card) => (
				<div key={card} className={cn(cardClassName, "grid gap-3 p-6")}>
					<Skeleton className="h-5 w-40 max-w-full" />
					<Skeleton variant="text" lines={2} />
				</div>
			))}
		</SkeletonRegion>
	);
}

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
	if (props.kind === "loading") return <SessionLoading />;
	return (
		<output
			data-id="auth-redirecting"
			className="block py-16 text-center font-mono text-muted text-sm"
		>
			{t("auth.status.redirecting")}
		</output>
	);
}
