import { IconLink, IconUserPlus } from "@tabler/icons-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import type { Invitee } from "./collaborators-api";
import { PersonAvatar } from "./person-avatar";

/** What a lookup found, waiting for the owner to confirm the invitation. */
export type InviteCandidate =
	| { kind: "account"; typed: string; invitee: Invitee }
	| { kind: "email"; typed: string };

export interface InviteeCardProps {
	candidate: InviteCandidate;
	busy: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

const CONFIRM_LABEL = {
	account: "collaborators.invitee.confirm",
	email: "collaborators.invitee.createLink",
} as const;

const CARD =
	"grid gap-3 rounded-md border border-[color-mix(in_srgb,var(--c-primary)_35%,var(--c-border-subtle))] py-2 pr-2 pl-3";

/**
 * The account an invitation would go to (name, avatar, masked email and
 * "email not verified"), or the email that will get a one-time link, with
 * the confirm step. Lets the owner spot a look-alike account first.
 */
export function InviteeCard({
	candidate,
	busy,
	onConfirm,
	onCancel,
}: InviteeCardProps) {
	const t = useT();
	const actions = (
		<div className="flex flex-wrap gap-2">
			<Button
				variant="primary"
				size="sm"
				data-id="modal-collaborators-confirm"
				loading={busy}
				leadingIcon={
					candidate.kind === "account" ? (
						<IconUserPlus size={16} aria-hidden="true" />
					) : (
						<IconLink size={16} aria-hidden="true" />
					)
				}
				onClick={onConfirm}
			>
				{t(CONFIRM_LABEL[candidate.kind])}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				data-id="modal-collaborators-cancel"
				disabled={busy}
				onClick={onCancel}
			>
				{t("common.actions.cancel")}
			</Button>
		</div>
	);

	if (candidate.kind === "email") {
		return (
			<div data-id="modal-collaborators-no-match" className={CARD}>
				<p className="m-0 text-sm">
					{/* The typed text goes in through the renderer, never parsed as tags. */}
					{renderRich(t("collaborators.invitee.noAccount", { email: "" }), {
						b: () => <b className="font-mono break-all">{candidate.typed}</b>,
					})}
				</p>
				{actions}
			</div>
		);
	}

	const { invitee } = candidate;
	const unverifiedEmailMatch =
		!invitee.emailVerified &&
		candidate.typed.includes("@") &&
		!candidate.typed.startsWith("@");
	return (
		<div data-id={`invite-match-${invitee.username}`} className={CARD}>
			<div className="flex flex-wrap items-center gap-3">
				<PersonAvatar
					name={invitee.name || invitee.username}
					picture={invitee.picture}
				/>
				<span className="min-w-0 flex-1 basis-40 font-mono text-[0.8125rem]">
					<b>{invitee.name || invitee.username}</b> · @{invitee.username}
					{invitee.maskedEmail ? (
						<span className="block text-muted">{invitee.maskedEmail}</span>
					) : null}
				</span>
				{invitee.emailVerified ? null : (
					<Badge tone="warning" data-id="invite-match-unverified">
						{t("collaborators.row.emailUnverified")}
					</Badge>
				)}
			</div>
			{unverifiedEmailMatch ? (
				<p
					data-id="invite-match-unverified-warning"
					className="m-0 text-sm text-warning-text"
				>
					{t("collaborators.invitee.unverifiedWarning")}
				</p>
			) : null}
			{actions}
		</div>
	);
}
