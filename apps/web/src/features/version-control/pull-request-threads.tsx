import type {
	MergeChange,
	PullRequestDetail,
} from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { CommentComposer } from "../comments/comment-composer";
import { useCommentErrorMessage } from "../comments/comment-errors";
import { useThreadActions } from "../comments/thread-actions";
import { useCommentActions } from "../comments/use-comments";
import { usePeople } from "../comments/use-people";
import { PullRequestChangeItem, ThreadList } from "./pull-request-change-item";
import { usePullRequestThreads } from "./use-pull-requests";

export interface PullRequestThreadsProps {
	pullRequest: PullRequestDetail;
	/** Its members are offered after `@`. */
	workspaceId: string | null;
	/** A comment to bring into view (from a link). */
	focusedCommentId: string | null;
}

/**
 * The changes of a pull request, each with its comment threads and a
 * Comment box, then the discussion of the pull request as a whole.
 */
export function PullRequestThreads({
	pullRequest,
	workspaceId,
	focusedCommentId,
}: PullRequestThreadsProps) {
	const t = useT();
	const errorText = useCommentErrorMessage();
	const people = usePeople(workspaceId);
	const threads = usePullRequestThreads(
		pullRequest.sourceId,
		pullRequest.id,
		true,
	);
	const { actions, confirm } = useThreadActions(
		pullRequest.sourceId,
		null,
		pullRequest.id,
	);
	const create = useCommentActions(pullRequest.sourceId).create;
	const [commenting, setCommenting] = useState<string | null>(null);
	const changes: readonly MergeChange[] = pullRequest.preview?.changes ?? [];
	const keys = new Set(changes.map((change) => change.key));
	const all = threads.data ?? [];
	// Threads on a change no longer shown (merged, declined) join the discussion.
	const general = all.filter(
		(thread) => thread.changeKey === null || !keys.has(thread.changeKey),
	);
	const write = (body: string, changeKey?: string) =>
		create.mutateAsync({
			nodeId: null,
			body,
			pullRequestId: pullRequest.id,
			...(changeKey ? { changeKey } : {}),
		});
	const list = { people, actions, focusedCommentId };
	return (
		<>
			{changes.length > 0 ? (
				<section className="grid gap-2">
					<h3 className="m-0 font-semibold text-sm">
						{t("versionControl.pullRequests.changes")}
					</h3>
					<ul
						data-id="pull-request-changes"
						className="m-0 grid list-none gap-3 p-0"
					>
						{changes.map((change) => {
							const own = all.filter(
								(thread) => thread.changeKey === change.key,
							);
							return (
								<PullRequestChangeItem
									key={change.key}
									pullRequestId={pullRequest.id}
									change={change}
									threads={own}
									{...list}
									commenting={commenting === change.key}
									onComment={() => setCommenting(change.key)}
									onCancel={() => setCommenting(null)}
									onSubmit={async (body) => {
										await write(body, change.key);
										setCommenting(null);
									}}
								/>
							);
						})}
					</ul>
				</section>
			) : null}
			<section className="grid gap-2">
				<h3 className="m-0 font-semibold text-sm">
					{t("versionControl.pullRequests.discussion")}
				</h3>
				{threads.isPending ? (
					<Skeleton className="h-16" />
				) : threads.isError ? (
					<Alert tone="danger">{t("collections.comments.loadFailed")}</Alert>
				) : (
					<ThreadList threads={general} {...list} />
				)}
				<CommentComposer
					label={t("versionControl.pullRequests.composerLabel")}
					submitLabel={t("versionControl.pullRequests.send")}
					people={people}
					dataId="pull-request-composer"
					onSubmit={async (body) => {
						await write(body);
					}}
				/>
				{create.isError ? (
					<Alert tone="danger">{errorText(create.error)}</Alert>
				) : null}
			</section>
			{confirm}
		</>
	);
}
