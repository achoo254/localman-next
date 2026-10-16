import { IconGitPullRequest } from "@tabler/icons-react";
import { Alert } from "../../components/ui/alert";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useI18n } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import { PullRequestDialog } from "./pull-request-dialog";
import {
	clearPullRequestFocus,
	focusPullRequest,
	usePullRequestFocus,
} from "./pull-request-focus";
import { PullRequestStatusBadge } from "./pull-request-status";
import { usePullRequests } from "./use-pull-requests";

export interface PullRequestsPanelProps {
	collectionId: string;
	workspaceId: string | null;
	/** The caller's role on the collection. */
	role: "editor" | "viewer" | null;
}

/** Pull requests into and out of the collection, newest first. */
export function PullRequestsPanel({
	collectionId,
	workspaceId,
	role,
}: PullRequestsPanelProps) {
	const { t, formatDate } = useI18n();
	const errorText = useForkErrorMessage();
	const list = usePullRequests(collectionId);
	const focus = usePullRequestFocus();
	const opened = focus?.collectionId === collectionId ? focus : null;
	const shown = list.data?.find((item) => item.id === opened?.pullRequestId);
	return (
		<>
			{list.isPending ? (
				<SkeletonRegion label={t("versionControl.pullRequests.panel")}>
					<Skeleton className="h-16" />
				</SkeletonRegion>
			) : list.isError ? (
				<Alert tone="danger">{errorText(list.error)}</Alert>
			) : list.data.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("versionControl.pullRequests.empty")}
				</p>
			) : (
				<ul
					data-id="pull-requests-list"
					className="m-0 grid list-none gap-2 p-0"
				>
					{list.data.map((pr) => (
						<li key={pr.id}>
							<button
								type="button"
								data-id="pull-requests-item"
								aria-label={t("versionControl.pullRequests.open", {
									title: pr.title,
								})}
								className="flex w-full cursor-pointer items-start gap-2 rounded-md border border-border-subtle bg-transparent p-2 text-left hover:bg-fg/6"
								onClick={() =>
									focusPullRequest({
										collectionId,
										pullRequestId: pr.id,
										commentId: null,
									})
								}
							>
								<IconGitPullRequest
									size={16}
									aria-hidden="true"
									className="mt-0.5 flex-none text-icon-muted"
								/>
								<span className="grid min-w-0 flex-1 gap-1">
									<span className="truncate font-medium text-sm">
										{pr.title}
									</span>
									<span className="text-muted text-xs">
										{t("versionControl.pullRequests.by", {
											person: pr.authorName ?? "?",
											date: formatDate(pr.createdAt),
										})}
									</span>
								</span>
								<PullRequestStatusBadge status={pr.status} />
							</button>
						</li>
					))}
				</ul>
			)}
			{opened ? (
				<PullRequestDialog
					id={opened.pullRequestId}
					workspaceId={workspaceId}
					canEditFork={shown?.forkId === collectionId && role === "editor"}
					focusedCommentId={opened.commentId}
					onClose={clearPullRequestFocus}
				/>
			) : null}
		</>
	);
}
