import { Link } from "react-router";
import { UserAvatar } from "../../components/layout/user-avatar";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { cn } from "../../lib/cn";
import { type CurrentUser, displayName } from "../auth/current-user";
import { invitePageErrorMessage } from "../collaborators/invite-errors";
import { SwitchAccountButton } from "../collaborators/switch-account-button";
import type {
	WorkspaceIneligibleReason,
	WorkspaceInvitePreview,
} from "./workspace-invites-api";
import { roleLabel } from "./workspace-labels";

export interface WorkspaceInviteCardProps {
	preview: WorkspaceInvitePreview;
	user: CurrentUser;
	/** From the preview, or from a refused accept. */
	reason: WorkspaceIneligibleReason | null;
	accepting: boolean;
	/** Accept failed for another reason (network, rate limit…). */
	acceptError: unknown;
	onAccept: () => void;
	onOpen: () => void;
}

const HELP = "m-0 text-muted text-[0.8125rem]";

/** A usable workspace invitation: who invites, to what role, and what you can do. */
export function WorkspaceInviteCard({
	preview,
	user,
	reason,
	accepting,
	acceptError,
	onAccept,
	onOpen,
}: WorkspaceInviteCardProps) {
	const { t, formatDate } = useI18n();
	const { workspace, inviter } = preview;
	const expires = preview.expiresAt ? formatDate(preview.expiresAt) : "";
	const inviterName = inviter.name
		? `${inviter.name} (@${inviter.username})`
		: `@${inviter.username}`;
	const email = preview.inviteeEmail;
	const ineligible =
		reason === "NOT_INVITEE" || reason === "EMAIL_NOT_VERIFIED";
	return (
		<Card
			data-id="ws-invite-page"
			className="mx-auto grid w-full max-w-md gap-4 p-6"
		>
			<h1 className="m-0 min-w-0 break-words font-bold font-mono text-xl">
				{t("workspaces.invitePage.title", { workspace: workspace.name })}
			</h1>
			<p className="m-0 text-sm" data-id="ws-invite-page-inviter">
				{t("workspaces.invitePage.inviter", {
					inviter: inviterName,
					role: roleLabel(preview.role, t),
				})}
			</p>
			{expires ? (
				<p className={HELP} data-id="ws-invite-page-expiry">
					{preview.kind === "link"
						? t("workspaces.invitePage.oneUse", { date: expires })
						: t("invite.preview.expires", { date: expires })}
				</p>
			) : null}
			<div className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm">
				<UserAvatar user={user} />
				<span className="min-w-0 break-words">
					{/* The account goes in through the renderer, never parsed as tags. */}
					{renderRich(t("invite.preview.signedInAs", { account: "" }), {
						b: () => (
							<b>
								{user.email ?? displayName(user, t("auth.accountFallback"))}
							</b>
						),
					})}
				</span>
			</div>
			{reason === "ALREADY_MEMBER" ? (
				<>
					<Alert tone="info" data-id="ws-invite-page-member">
						{t("workspaces.invitePage.alreadyMember", {
							workspace: workspace.name,
						})}
					</Alert>
					<Button
						variant="primary"
						block
						data-id="ws-invite-page-open"
						onClick={onOpen}
					>
						{t("workspaces.invitePage.open")}
					</Button>
				</>
			) : null}
			{reason === "MEMBER_LIMIT" ? (
				<Alert tone="warning" data-id="ws-invite-page-full">
					{t("workspaces.invitePage.full")}
				</Alert>
			) : null}
			{ineligible ? (
				<>
					<Alert
						tone="warning"
						title={t("invite.preview.ineligibleTitle")}
						data-id="ws-invite-page-ineligible"
					>
						{!email
							? t("invite.preview.ineligibleOther")
							: reason === "EMAIL_NOT_VERIFIED"
								? t("invite.preview.ineligibleUnverified", { email })
								: t("invite.preview.ineligibleWrongAccount", { email })}
					</Alert>
					<SwitchAccountButton variant="primary" />
				</>
			) : null}
			{reason === null ? (
				<>
					{acceptError ? (
						<Alert tone="danger" data-id="ws-invite-page-error">
							{invitePageErrorMessage(acceptError, t)}
						</Alert>
					) : null}
					<Button
						variant="primary"
						block
						data-id="ws-invite-page-accept"
						loading={accepting}
						onClick={onAccept}
					>
						{t("workspaces.invitePage.accept")}
					</Button>
					<SwitchAccountButton variant="ghost" />
				</>
			) : null}
			<Link
				to="/api-client"
				data-id="ws-invite-page-back"
				className={cn(
					buttonClassName({ variant: "ghost", block: true }),
					"no-underline",
				)}
			>
				{t("workspaces.invitePage.back")}
			</Link>
		</Card>
	);
}
