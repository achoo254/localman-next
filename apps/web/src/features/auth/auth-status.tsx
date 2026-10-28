import { MAIN_CLASS } from "../../components/layout/skip-link";
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

/** Page-shaped skeleton (title, lead, two cards), announced once. */
function SessionSkeleton() {
	const t = useT();
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

/**
 * The session is being checked inside a page that already has its frame:
 * after 150 ms, the skeleton that says "Checking your session…" once.
 */
function SessionLoading() {
	const shown = useDelayedFlag(true);
	return shown ? <SessionSkeleton /> : null;
}

/**
 * The signed-in shell checks the session before it can draw its header:
 * after 150 ms, a top bar placeholder at the header's height and the
 * skeleton in the page container, so nothing moves when the shell arrives.
 */
export function ShellSessionLoading() {
	const shown = useDelayedFlag(true);
	if (!shown) return null;
	return (
		<>
			<div
				data-id="auth-loading-topbar"
				className="border-border-subtle border-b pt-[env(safe-area-inset-top)]"
			>
				<div className="mx-auto flex min-h-(--topbar-h) w-full max-w-page items-center justify-between gap-3 px-gutter">
					<Skeleton className="h-6 w-28" />
					<Skeleton variant="circle" className="size-8" />
				</div>
			</div>
			<div className={MAIN_CLASS}>
				<SessionSkeleton />
			</div>
		</>
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
