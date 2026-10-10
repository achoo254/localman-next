import { Link } from "react-router";
import { UserAvatar } from "../../components/layout/user-avatar";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useI18n } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Translate } from "../../i18n/translate";
import { ProjectAvatar } from "../../pages/projects/project-avatar";
import { type CurrentUser, displayName } from "../auth/current-user";
import { invitePageErrorMessage } from "./invite-errors";
import type { IneligibleReason, InvitePreview } from "./invites-api";
import { SwitchAccountButton } from "./switch-account-button";

export interface InvitePreviewCardProps {
	preview: InvitePreview;
	user: CurrentUser;
	/** From the preview, or from a refused accept. */
	reason: IneligibleReason | null;
	accepting: boolean;
	/** Accept failed for another reason (network, rate limit…). */
	acceptError: unknown;
	onAccept: () => void;
}

const HELP = "m-0 text-muted text-[0.8125rem]";

function ineligibleText(
	reason: IneligibleReason | null,
	email: string | null,
	t: Translate,
): string {
	if (!email) return t("invite.preview.ineligibleOther");
	if (reason === "EMAIL_NOT_VERIFIED") {
		return t("invite.preview.ineligibleUnverified", { email });
	}
	return t("invite.preview.ineligibleWrongAccount", { email });
}

/** A usable invite or magic link: who invites, to what, and what you can do. */
export function InvitePreviewCard({
	preview,
	user,
	reason,
	accepting,
	acceptError,
	onAccept,
}: InvitePreviewCardProps) {
	const { t, formatDate } = useI18n();
	const { project, inviter } = preview;
	const expires = preview.expiresAt ? formatDate(preview.expiresAt) : "";
	const inviterName = inviter.name
		? `${inviter.name} (@${inviter.username})`
		: `@${inviter.username}`;
	const ineligible =
		reason === "NOT_INVITEE" || reason === "EMAIL_NOT_VERIFIED";
	return (
		<Card
			data-id="invite-page"
			className="mx-auto grid w-full max-w-md gap-4 p-6"
		>
			<div className="flex items-center gap-3" data-id="invite-page-project">
				<ProjectAvatar name={project.name} />
				<h1 className="m-0 min-w-0 break-words font-bold font-mono text-xl">
					{t("invite.preview.title", { project: project.name })}
				</h1>
			</div>
			<p className="m-0 text-sm" data-id="invite-page-inviter">
				{t("invite.preview.inviter", { inviter: inviterName })}
			</p>
			{expires ? (
				<p className={HELP} data-id="invite-page-expiry">
					{t(
						preview.kind === "magic"
							? "invite.preview.expiresShared"
							: "invite.preview.expires",
						{ date: expires },
					)}
				</p>
			) : null}
			<div
				className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm"
				data-id="invite-page-account"
			>
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
					<Alert tone="info" data-id="invite-page-member">
						{t("invite.preview.alreadyMember", { project: project.name })}
					</Alert>
					<Link
						to={`/projects/${encodeURIComponent(project.id)}`}
						data-id="invite-page-open-project"
						className={buttonClassName({ variant: "primary", block: true })}
					>
						{t("invite.preview.openProject")}
					</Link>
				</>
			) : null}
			{reason === "MEMBER_LIMIT" ? (
				<Alert tone="warning" data-id="invite-page-full">
					{t("invite.preview.full")}
				</Alert>
			) : null}
			{reason === "REMOVED_BY_OWNER" ? (
				<Alert tone="warning" data-id="invite-page-removed">
					{t("invite.preview.removed")}
				</Alert>
			) : null}
			{ineligible ? (
				<>
					<Alert
						tone="warning"
						title={t("invite.preview.ineligibleTitle")}
						data-id="invite-page-ineligible"
					>
						{ineligibleText(reason, preview.inviteeEmail, t)}
					</Alert>
					<SwitchAccountButton variant="primary" />
				</>
			) : null}
			{reason === null ? (
				<>
					{acceptError ? (
						<Alert tone="danger" data-id="invite-page-error">
							{invitePageErrorMessage(acceptError, t)}
						</Alert>
					) : null}
					<Button
						variant="primary"
						block
						data-id="invite-page-accept"
						loading={accepting}
						onClick={onAccept}
					>
						{t("invite.preview.accept")}
					</Button>
					<SwitchAccountButton variant="ghost" />
				</>
			) : null}
			<Link
				to="/projects"
				data-id="invite-page-back"
				className={buttonClassName({ variant: "ghost", block: true })}
			>
				{t("invite.backToProjects")}
			</Link>
		</Card>
	);
}
