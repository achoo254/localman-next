import { useRef, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { isPlanLimitError } from "../../pages/projects/projects-api";
import { appPageUrl } from "../../platform/navigation";
import {
	type InviteResult,
	inviteCollaborator,
	lookupInvitee,
} from "./collaborators-api";
import { inviteErrorMessage, looksLikeEmail } from "./invite-errors";
import type { InviteCandidate } from "./invitee-card";

/** The one-time link of the invitation just made; never shown again. */
export interface CreatedLink {
	url: string;
	who: string;
	expiresAt: string | null;
	/** Email-only invitations: the link is the only way to reach them. */
	copyNow: boolean;
}

export interface InviteFlowOptions {
	projectId: string;
	/** `message`: what was done, e.g. "Invited Lan", for announcements. */
	onInvited: (result: InviteResult, message: string) => void;
	onPlanLimit: () => void;
}

/**
 * State of the invite form: `look` checks what was typed (one lookup per
 * press, as lookups and invitations share the owner's budget), `confirm`
 * invites the candidate. Editing the input drops the candidate.
 */
export function useInviteFlow({
	projectId,
	onInvited,
	onPlanLimit,
}: InviteFlowOptions) {
	const toast = useToast();
	const t = useT();
	const [value, setValue] = useState("");
	const [checking, setChecking] = useState(false);
	const [candidate, setCandidate] = useState<InviteCandidate | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [created, setCreated] = useState<CreatedLink | null>(null);
	// What the input holds now, so a late lookup answer for older text is ignored.
	const latest = useRef("");

	function change(next: string) {
		latest.current = next.trim();
		setValue(next);
		setCandidate(null);
		setError(null);
	}

	function fail(cause: unknown) {
		if (isPlanLimitError(cause)) onPlanLimit();
		else setError(inviteErrorMessage(cause, t));
	}

	async function look() {
		const typed = value.trim();
		if (typed === "") {
			setError(t("collaborators.form.empty"));
			return;
		}
		setChecking(true);
		setError(null);
		try {
			const invitee = await lookupInvitee(projectId, typed);
			if (latest.current !== typed) return;
			if (invitee) setCandidate({ kind: "account", typed, invitee });
			else if (looksLikeEmail(typed)) setCandidate({ kind: "email", typed });
			else setError(t("collaborators.errors.notFound"));
		} catch (cause) {
			if (latest.current === typed) fail(cause);
		} finally {
			setChecking(false);
		}
	}

	async function confirm(target: InviteCandidate) {
		setConfirming(true);
		setError(null);
		try {
			const result = await inviteCollaborator(projectId, target.typed);
			const invitee = result.invitee;
			const who = invitee
				? invitee.name || `@${invitee.username}`
				: target.typed;
			const title = invitee
				? t("collaborators.form.invited", { who })
				: t("collaborators.form.linkCreated", { who });
			onInvited(result, title);
			change("");
			setCreated({
				url: appPageUrl(result.inviteLink),
				who,
				expiresAt: result.collaborator.expiresAt,
				copyNow: invitee === null,
			});
			toast.show({
				title,
				description:
					invitee && result.notified
						? t("collaborators.form.notified")
						: undefined,
			});
		} catch (cause) {
			setCandidate(null);
			fail(cause);
		} finally {
			setConfirming(false);
		}
	}

	return {
		value,
		change,
		checking,
		candidate,
		cancel: () => setCandidate(null),
		confirming,
		error,
		created,
		look,
		confirm,
	};
}
