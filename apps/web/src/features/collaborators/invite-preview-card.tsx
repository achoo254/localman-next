import { Link } from "react-router";
import { UserAvatar } from "../../components/layout/user-avatar";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { formatDate } from "../../lib/format";
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

function ineligibleText(reason: IneligibleReason | null, email: string | null) {
	if (!email) {
		return "Lời mời này gửi cho một tài khoản khác. Hãy đăng nhập bằng tài khoản được mời.";
	}
	if (reason === "EMAIL_NOT_VERIFIED") {
		return `Lời mời gửi cho ${email}. Email của tài khoản này chưa được xác minh: hãy đăng nhập bằng Google/GitHub có email đã xác minh trùng với email này.`;
	}
	return `Lời mời gửi cho ${email}. Hãy đăng nhập bằng tài khoản được mời, hoặc liên kết Google/GitHub có email đã xác minh trùng với email này.`;
}

const backLink = (
	<Link
		to="/projects"
		data-id="invite-page-back"
		className={buttonClassName({ variant: "ghost", block: true })}
	>
		Về Projects
	</Link>
);

/** A usable invite or magic link: who invites, to what, and what you can do. */
export function InvitePreviewCard({
	preview,
	user,
	reason,
	accepting,
	acceptError,
	onAccept,
}: InvitePreviewCardProps) {
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
					Tham gia {project.name}
				</h1>
			</div>
			<p className="m-0 text-sm" data-id="invite-page-inviter">
				{inviterName} mời bạn cộng tác.
			</p>
			{expires ? (
				<p className={HELP} data-id="invite-page-expiry">
					{preview.kind === "magic" ? "Link dùng chung · hết hạn" : "Hết hạn"}{" "}
					{expires}
				</p>
			) : null}
			<div
				className="flex items-center gap-2 rounded-md border border-border-subtle px-3 py-2 text-sm"
				data-id="invite-page-account"
			>
				<UserAvatar user={user} />
				<span className="min-w-0 break-words">
					Bạn đang đăng nhập bằng <b>{user.email ?? displayName(user)}</b>
				</span>
			</div>
			{reason === "ALREADY_MEMBER" ? (
				<>
					<Alert tone="info" data-id="invite-page-member">
						Bạn đã là thành viên của {project.name}.
					</Alert>
					<Link
						to={`/projects/${encodeURIComponent(project.id)}`}
						data-id="invite-page-open-project"
						className={buttonClassName({ variant: "primary", block: true })}
					>
						Mở project
					</Link>
				</>
			) : null}
			{reason === "MEMBER_LIMIT" ? (
				<Alert tone="warning" data-id="invite-page-full">
					Project đã đủ thành viên theo gói của chủ project. Nhờ chủ project xoá
					bớt thành viên.
				</Alert>
			) : null}
			{ineligible ? (
				<>
					<Alert
						tone="warning"
						title="Tài khoản này không nhận được lời mời"
						data-id="invite-page-ineligible"
					>
						{ineligibleText(reason, preview.inviteeEmail)}
					</Alert>
					<SwitchAccountButton variant="primary" />
				</>
			) : null}
			{reason === null ? (
				<>
					{acceptError ? (
						<Alert tone="danger" data-id="invite-page-error">
							{invitePageErrorMessage(acceptError)}
						</Alert>
					) : null}
					<Button
						variant="primary"
						block
						data-id="invite-page-accept"
						disabled={accepting}
						onClick={onAccept}
					>
						{accepting ? "Đang tham gia…" : "Tham gia"}
					</Button>
					<SwitchAccountButton variant="ghost" />
				</>
			) : null}
			{backLink}
		</Card>
	);
}
