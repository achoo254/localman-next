import { IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Navigate, useParams } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useFeatures } from "../../config/features";
import { AuthStatus } from "../../features/auth/auth-status";
import { LoginLink } from "../../features/auth/login-link";
import { useCurrentUser } from "../../features/auth/use-current-user";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";
import { RunImportFlow } from "./run-import-flow";

/**
 * Step 1 for anonymous visitors: what the button does, and sign-in or
 * sign-up links back to this page. Nothing is loaded, and nobody is sent
 * to sign in without asking.
 */
function RunSignIn({ returnTo }: { returnTo: string }) {
	const t = useT();
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => heading.current?.focus(), []);
	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="run-sign-in"
				className="mx-auto grid w-full max-w-md justify-items-center gap-4 p-6 text-center"
			>
				<span className="grid size-16 place-items-center rounded-lg border border-border border-dashed bg-surface-subtle text-icon-muted">
					<IconPlayerPlay size={32} aria-hidden="true" />
				</span>
				<h1
					ref={heading}
					tabIndex={-1}
					className="m-0 font-bold font-mono text-xl"
				>
					{t("publicSharing.view.run.signInTitle")}
				</h1>
				<p className="m-0 text-muted text-sm">
					{t("publicSharing.view.run.signInText")}
				</p>
				<LoginLink
					returnTo={returnTo}
					data-id="run-sign-in-login"
					className={buttonClassName({ variant: "primary", block: true })}
				>
					{t("publicSharing.view.run.signIn")}
				</LoginLink>
				<LoginLink
					returnTo={returnTo}
					prompt="create"
					data-id="run-sign-in-signup"
					className={buttonClassName({ variant: "secondary", block: true })}
				>
					{t("publicSharing.view.run.signUp")}
				</LoginLink>
			</Card>
		</div>
	);
}

function RunButton({ buttonId }: { buttonId: string }) {
	const t = useT();
	useAppTitle(t("publicSharing.view.run.pageTitle"));
	const session = useCurrentUser();
	switch (session.status) {
		case "loading":
			return <AuthStatus kind="loading" />;
		case "error":
			return <AuthStatus kind="error" error={session.error} />;
		case "anonymous":
			return <RunSignIn returnTo={`/run/${encodeURIComponent(buttonId)}`} />;
		default:
			return <RunImportFlow buttonId={buttonId} />;
	}
}

/**
 * `/run/:buttonId`, opened from a "Run in Localman" badge: sign in, pick
 * a workspace, see what gets imported, import. Public on purpose so the
 * first step can explain before asking to sign in. Home while
 * `publicSharing` is off.
 */
export function RunButtonPage() {
	const { publicSharing } = useFeatures();
	const { buttonId = "" } = useParams();
	if (!publicSharing) return <Navigate to="/" replace />;
	return <RunButton key={buttonId} buttonId={buttonId} />;
}
