import type { WorkspaceRole } from "@localman/shared/access";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { appPageUrl } from "../../platform/navigation";
import { membersKey } from "./current-workspace";
import { planLimitOf, workspaceErrorMessage } from "./workspace-errors";
import { DEFAULT_INVITE_ROLE, invitationLabel } from "./workspace-labels";
import {
	type IssuedInvitation,
	createWorkspaceInviteLink,
	inviteWorkspaceMember,
} from "./workspace-members-api";

/** The one-time link just issued; the API never returns it again. */
export interface IssuedLink {
	url: string;
	label: string;
	expiresAt: string | null;
	/** Copied as soon as it shows: email-only invitations and bare links. */
	autoCopy: boolean;
}

/**
 * State of the invite form: invite by username or email with a role, or
 * issue a one-use link with that role. A full workspace (403
 * `PLAN_LIMIT_REACHED`) refreshes the member list so the seats line and
 * the "Requires Pro" card catch up.
 */
export function useWorkspaceInvite(workspaceId: string) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const [value, setValue] = useState("");
	const [role, setRole] = useState<WorkspaceRole>(DEFAULT_INVITE_ROLE);
	const [error, setError] = useState<string | null>(null);
	const [issued, setIssued] = useState<IssuedLink | null>(null);

	const refresh = () =>
		client.invalidateQueries({ queryKey: membersKey(workspaceId) });

	function show(result: IssuedInvitation, label: string, autoCopy: boolean) {
		setIssued({
			url: appPageUrl(result.inviteLink),
			label,
			expiresAt: result.invitation.expiresAt,
			autoCopy,
		});
		void refresh();
	}

	const invite = useMutation({
		mutationFn: (input: { who: string; role: WorkspaceRole }) =>
			inviteWorkspaceMember(workspaceId, input.who, input.role),
		onSuccess: (result) => {
			const who = invitationLabel(result.invitation, t);
			// Nobody to notify: the link is the only way to reach them.
			const byLink = result.invitation.kind !== "account";
			show(result, t("workspaces.invite.linkLabel", { who }), byLink);
			setValue("");
			toast.show({
				tone: "success",
				title: byLink
					? t("workspaces.invite.linkFor", { who })
					: t("workspaces.invite.invited", { who }),
				description:
					!byLink && result.notified
						? t("workspaces.invite.notified")
						: undefined,
			});
		},
		onError: (cause) => {
			setError(workspaceErrorMessage(cause, t));
			if (planLimitOf(cause)) void refresh();
		},
	});

	const link = useMutation({
		mutationFn: (linkRole: WorkspaceRole) =>
			createWorkspaceInviteLink(workspaceId, linkRole),
		onSuccess: (result) => {
			show(result, t("workspaces.invite.linkLabelAnyone"), true);
			toast.show({
				tone: "success",
				title: t("workspaces.invite.linkCreated"),
			});
		},
		onError: (cause) => {
			toast.show({ tone: "error", title: workspaceErrorMessage(cause, t) });
			if (planLimitOf(cause)) void refresh();
		},
	});

	function change(next: string) {
		setValue(next);
		setError(null);
	}

	function submit() {
		const who = value.trim();
		if (who === "") {
			setError(t("workspaces.invite.empty"));
			return;
		}
		setError(null);
		invite.mutate({ who, role });
	}

	return {
		value,
		change,
		role,
		setRole,
		error,
		issued,
		submit,
		inviting: invite.isPending,
		createLink: () => link.mutate(role),
		linking: link.isPending,
	};
}
