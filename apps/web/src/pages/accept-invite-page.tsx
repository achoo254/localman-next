import { IconUsers } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useParams } from "react-router";
import { buttonClassName } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { AuthStatus } from "../features/auth/auth-status";
import { LoginLink } from "../features/auth/login-link";
import { useCurrentUser } from "../features/auth/use-current-user";
import { InviteDetails } from "../features/collaborators/invite-details";
import { useT } from "../i18n/i18n-context";
import { useAppTitle } from "../lib/use-document-title";

/**
 * Anonymous visitor: sign in or sign up, then come back here. The invite is
 * not previewed yet, so the project name stays private until sign-in.
 */
function InviteSignIn({ returnTo }: { returnTo: string }) {
	const t = useT();
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => heading.current?.focus(), []);
	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="invite-page"
				className="mx-auto grid w-full max-w-md justify-items-center gap-4 p-6 text-center"
			>
				<span className="grid size-16 place-items-center rounded-lg border border-border border-dashed bg-surface-subtle text-icon-muted">
					<IconUsers size={32} aria-hidden="true" />
				</span>
				<h1
					ref={heading}
					tabIndex={-1}
					className="m-0 font-bold font-mono text-xl"
				>
					{t("invite.signIn.title")}
				</h1>
				<p className="m-0 text-muted text-sm">{t("invite.signIn.text")}</p>
				<LoginLink
					returnTo={returnTo}
					data-id="invite-page-login"
					className={buttonClassName({ variant: "primary", block: true })}
				>
					{t("invite.signIn.signIn")}
				</LoginLink>
				<LoginLink
					returnTo={returnTo}
					prompt="create"
					data-id="invite-page-signup"
					className={buttonClassName({ variant: "secondary", block: true })}
				>
					{t("invite.signIn.signUp")}
				</LoginLink>
			</Card>
		</div>
	);
}

/**
 * `/invite/:token`: one-time invitations and magic links. A public page
 * (outside the signed-in shell, whose guard would skip "Sign up").
 */
export function AcceptInvitePage() {
	const t = useT();
	useAppTitle(t("invite.pageTitle"));
	const { token = "" } = useParams();
	const session = useCurrentUser();
	if (session.status === "loading") return <AuthStatus kind="loading" />;
	if (session.status === "error") {
		return <AuthStatus kind="error" error={session.error} />;
	}
	if (session.status === "anonymous") {
		return <InviteSignIn returnTo={`/invite/${encodeURIComponent(token)}`} />;
	}
	return <InviteDetails key={token} token={token} user={session.user} />;
}
