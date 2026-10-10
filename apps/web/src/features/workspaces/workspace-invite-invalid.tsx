import { IconLinkOff } from "@tabler/icons-react";
import { Link } from "react-router";
import { buttonClassName } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { useI18n } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { isRecord } from "../../lib/json-guards";
import type { TokenErrorCode } from "../collaborators/invite-invalid";

function expiredOn(error: unknown): string | null {
	if (!(error instanceof ApiError) || !isRecord(error.details)) return null;
	const at = error.details.expiresAt;
	return typeof at === "string" ? at : null;
}

/** Expired, used, revoked or unknown workspace invite link. */
export function WorkspaceInviteInvalid({
	code,
	error,
}: {
	code: TokenErrorCode;
	error: unknown;
}) {
	const { t, formatDate } = useI18n();
	const expiredAt = expiredOn(error);
	let title = t("invite.invalid.revokedTitle");
	let text = t("workspaces.invitePage.revokedText");
	if (code === "INVITE_EXPIRED") {
		title = t("invite.invalid.expiredTitle");
		text = expiredAt
			? t("invite.invalid.expiredText", { date: formatDate(expiredAt) })
			: t("invite.invalid.expiredTextNoDate");
	} else if (code === "INVITE_USED") {
		title = t("invite.invalid.usedTitle");
		text = t("invite.invalid.usedText");
	}
	return (
		<EmptyState
			data-id="ws-invite-page-invalid"
			headingLevel={1}
			icon={<IconLinkOff size={32} aria-hidden="true" />}
			title={title}
			action={
				<Link
					to="/api-client"
					data-id="ws-invite-page-back"
					className={cn(
						buttonClassName({ variant: "primary" }),
						"no-underline",
					)}
				>
					{t("workspaces.invitePage.back")}
				</Link>
			}
		>
			{text}
		</EmptyState>
	);
}
