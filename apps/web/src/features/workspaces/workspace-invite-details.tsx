import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import type { CurrentUser } from "../auth/current-user";
import { invitePageErrorMessage } from "../collaborators/invite-errors";
import { tokenErrorOf } from "../collaborators/invite-invalid";
import { InviteSkeleton } from "../collaborators/invite-skeleton";
import { WORKSPACES_KEY, useSelectWorkspace } from "./current-workspace";
import { WorkspaceInviteCard } from "./workspace-invite-card";
import { WorkspaceInviteInvalid } from "./workspace-invite-invalid";
import {
	type WorkspaceIneligibleReason,
	acceptWorkspaceInvite,
	previewWorkspaceInvite,
} from "./workspace-invites-api";
import { fetchWorkspaces } from "./workspaces-api";

/** Accept refusals that mean the same as a preview `reason`. */
function refusalOf(error: unknown): WorkspaceIneligibleReason | null {
	if (!(error instanceof ApiError)) return null;
	if (error.code === "NOT_INVITEE" || error.code === "EMAIL_NOT_VERIFIED") {
		return error.code;
	}
	return error.code === "PLAN_LIMIT_REACHED" ? "MEMBER_LIMIT" : null;
}

/**
 * Signed-in part of `/workspace-invite/:token`: preview the token, then
 * accept, make the workspace current and open the workbench. Each state
 * has one h1, focused when the state changes.
 */
export function WorkspaceInviteDetails({
	token,
	user,
}: {
	token: string;
	user: CurrentUser;
}) {
	const t = useT();
	const toast = useToast();
	const navigate = useNavigate();
	const client = useQueryClient();
	const select = useSelectWorkspace();
	const root = useRef<HTMLDivElement>(null);
	const [accepting, setAccepting] = useState(false);
	const [acceptError, setAcceptError] = useState<unknown>(null);
	const preview = useQuery({
		queryKey: ["workspace-invite", token],
		queryFn: () => previewWorkspaceInvite(token),
		staleTime: Number.POSITIVE_INFINITY,
	});
	// An accept that found the token unusable replaces the preview.
	const failure = tokenErrorOf(acceptError) ? acceptError : preview.error;

	/**
	 * The cached list may predate joining: fetch it first, so the workbench
	 * finds the joined workspace instead of falling back to the personal one.
	 */
	async function open(workspaceId: string) {
		select(workspaceId);
		try {
			await client.fetchQuery({
				queryKey: WORKSPACES_KEY,
				queryFn: fetchWorkspaces,
				staleTime: 0,
			});
		} catch {
			// The workbench loads the list again and reports a failure itself.
		}
		navigate("/api-client", { replace: true });
	}

	async function accept(name: string) {
		setAccepting(true);
		setAcceptError(null);
		try {
			const done = await acceptWorkspaceInvite(token);
			toast.show({
				tone: "success",
				title: done.alreadyMember
					? t("workspaces.invitePage.alreadyJoined", { workspace: name })
					: t("workspaces.invitePage.joined", { workspace: name }),
			});
			await open(done.workspaceId);
		} catch (error) {
			setAcceptError(error);
			setAccepting(false);
		}
	}

	const refusal = refusalOf(acceptError);
	const skeleton = useDelayedFlag(preview.isPending);
	const data = failure ? null : preview.data;
	const key = skeleton
		? "loading"
		: data
			? `ready-${refusal ?? data.reason ?? "ok"}`
			: failure
				? "failed"
				: "none";
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` names the visible state; focus its h1 whenever it changes.
	useEffect(() => {
		const heading = root.current?.querySelector("h1");
		if (!heading) return;
		heading.tabIndex = -1;
		heading.focus();
	}, [key]);

	let body: ReactNode = null;
	if (skeleton) {
		body = <InviteSkeleton />;
	} else if (data) {
		body = (
			<WorkspaceInviteCard
				preview={data}
				user={user}
				reason={refusal ?? data.reason}
				accepting={accepting}
				acceptError={refusal ? null : acceptError}
				onAccept={() => void accept(data.workspace.name)}
				onOpen={() => void open(data.workspace.id)}
			/>
		);
	} else if (failure) {
		const code = tokenErrorOf(failure);
		body = code ? (
			<WorkspaceInviteInvalid code={code} error={failure} />
		) : (
			<Card className="mx-auto grid w-full max-w-md gap-4 p-6">
				<h1 className="m-0 font-bold font-mono text-xl">
					{t("invite.failedTitle")}
				</h1>
				<Alert tone="danger" data-id="ws-invite-page-error">
					{invitePageErrorMessage(failure, t)}
				</Alert>
				<Button
					data-id="ws-invite-page-retry"
					onClick={() => {
						setAcceptError(null);
						void preview.refetch();
					}}
				>
					{t("common.cta.retry")}
				</Button>
			</Card>
		);
	}
	return (
		<div ref={root} className="py-8 md:py-16">
			{body}
		</div>
	);
}
