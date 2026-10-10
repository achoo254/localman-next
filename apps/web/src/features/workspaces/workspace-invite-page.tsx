import { IconUsers } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { Navigate, useParams } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useT } from "../../i18n/i18n-context";
import { useAppTitle } from "../../lib/use-document-title";
import { AuthStatus } from "../auth/auth-status";
import { LoginLink } from "../auth/login-link";
import { useCurrentUser } from "../auth/use-current-user";
import { useWorkspacesEnabled } from "./use-workspaces-enabled";
import { WorkspaceInviteDetails } from "./workspace-invite-details";

/**
 * Anonymous visitor: sign in or sign up, then come back here. The invite
 * is not previewed yet, so the workspace name stays private until sign-in.
 */
function WorkspaceInviteSignIn({ returnTo }: { returnTo: string }) {
	const t = useT();
	const heading = useRef<HTMLHeadingElement>(null);
	useEffect(() => heading.current?.focus(), []);
	return (
		<div className="py-8 md:py-16">
			<Card
				data-id="ws-invite-page"
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
					{t("workspaces.invitePage.signInTitle")}
				</h1>
				<p className="m-0 text-muted text-sm">
					{t("workspaces.invitePage.signInText")}
				</p>
				<LoginLink
					returnTo={returnTo}
					data-id="ws-invite-page-login"
					className={buttonClassName({ variant: "primary", block: true })}
				>
					{t("invite.signIn.signIn")}
				</LoginLink>
				<LoginLink
					returnTo={returnTo}
					prompt="create"
					data-id="ws-invite-page-signup"
					className={buttonClassName({ variant: "secondary", block: true })}
				>
					{t("invite.signIn.signUp")}
				</LoginLink>
			</Card>
		</div>
	);
}

function WorkspaceInvite() {
	const t = useT();
	useAppTitle(t("workspaces.invitePage.pageTitle"));
	const { token = "" } = useParams();
	const session = useCurrentUser();
	if (session.status === "loading") return <AuthStatus kind="loading" />;
	if (session.status === "error") {
		return <AuthStatus kind="error" error={session.error} />;
	}
	if (session.status === "anonymous") {
		return (
			<WorkspaceInviteSignIn
				returnTo={`/workspace-invite/${encodeURIComponent(token)}`}
			/>
		);
	}
	return (
		<WorkspaceInviteDetails key={token} token={token} user={session.user} />
	);
}

/**
 * `/workspace-invite/:token`: workspace invitations and one-use links. A
 * public page like `/invite/:token`, so anonymous visitors can sign up.
 */
export function WorkspaceInvitePage() {
	const workspaces = useWorkspacesEnabled();
	return workspaces ? (
		<WorkspaceInvite />
	) : (
		<Navigate to="/api-client" replace />
	);
}
