import type {
	CommentThreadView,
	MergeChange,
} from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { DiffView } from "../collections/diff-view";
import { CommentComposer } from "../comments/comment-composer";
import { CommentThread } from "../comments/comment-thread";
import type { MentionCandidate } from "../comments/mention-suggestions";
import type { ThreadActions } from "../comments/thread-actions";
import { useForkErrorMessage } from "./fork-errors";
import { usePullRequestChangeDiff } from "./use-pull-requests";

export interface ThreadListProps {
	threads: readonly CommentThreadView[];
	people: readonly MentionCandidate[];
	actions: ThreadActions;
	focusedCommentId: string | null;
}

export function ThreadList({
	threads,
	people,
	actions,
	focusedCommentId,
}: ThreadListProps) {
	if (threads.length === 0) return null;
	return (
		<ol className="m-0 grid list-none gap-3 p-0">
			{threads.map((thread) => (
				<CommentThread
					key={thread.id}
					thread={thread}
					people={people}
					actions={actions}
					focused={thread.comments.some(
						(comment) => comment.id === focusedCommentId,
					)}
				/>
			))}
		</ol>
	);
}

export interface PullRequestChangeItemProps
	extends Omit<ThreadListProps, "threads"> {
	pullRequestId: string;
	change: MergeChange;
	/** The threads about this change. */
	threads: readonly CommentThreadView[];
	commenting: boolean;
	onComment: () => void;
	onCancel: () => void;
	onSubmit: (body: string) => Promise<void>;
}

/** One change: what it does, its diff on demand, its threads, a Comment box. */
export function PullRequestChangeItem(props: PullRequestChangeItemProps) {
	const t = useT();
	const errorText = useForkErrorMessage();
	const { change } = props;
	const [open, setOpen] = useState(false);
	const diff = usePullRequestChangeDiff(props.pullRequestId, change.key, open);
	return (
		<li
			data-id="pull-request-change"
			className="grid gap-2 rounded-md border border-border-subtle p-2"
		>
			<div className="flex flex-wrap items-center gap-2 text-sm">
				<span className="flex-1">
					{t(`versionControl.sync.${change.kind}`, {
						kind: t(`versionControl.kinds.${change.entityKind}`),
						name: change.name,
					})}
				</span>
				{props.threads.length > 0 ? (
					<span className="text-muted text-xs">
						{t("versionControl.pullRequests.changeComments", {
							count: props.threads.length,
						})}
					</span>
				) : null}
				<Button
					size="sm"
					variant="ghost"
					aria-expanded={open}
					data-id="pull-request-change-diff"
					onClick={() => setOpen((value) => !value)}
				>
					{t(
						open
							? "versionControl.pullRequests.hideDiff"
							: "versionControl.pullRequests.showDiff",
					)}
				</Button>
				<Button
					size="sm"
					variant="ghost"
					data-id="pull-request-change-comment"
					onClick={props.onComment}
				>
					{t("versionControl.pullRequests.comment")}
				</Button>
			</div>
			{open ? (
				diff.isPending ? (
					<Skeleton className="h-16" />
				) : diff.isError ? (
					<Alert tone="danger">{errorText(diff.error)}</Alert>
				) : (
					<DiffView
						before={diff.data.before}
						after={diff.data.after}
						label={t("versionControl.pullRequests.diffLabel", {
							name: change.name,
						})}
					/>
				)
			) : null}
			<ThreadList
				threads={props.threads}
				people={props.people}
				actions={props.actions}
				focusedCommentId={props.focusedCommentId}
			/>
			{props.commenting ? (
				<CommentComposer
					label={t("versionControl.pullRequests.changeComposerLabel", {
						name: change.name,
					})}
					submitLabel={t("versionControl.pullRequests.send")}
					people={props.people}
					dataId="pull-request-change-composer"
					autoFocus
					onCancel={props.onCancel}
					onSubmit={props.onSubmit}
				/>
			) : null}
		</li>
	);
}
