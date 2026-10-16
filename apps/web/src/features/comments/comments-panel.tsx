import { useEffect, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useT } from "../../i18n/i18n-context";
import { CommentComposer } from "./comment-composer";
import { useCommentErrorMessage } from "./comment-errors";
import { clearCommentFocus, useCommentFocus } from "./comment-focus";
import { CommentThread } from "./comment-thread";
import { useThreadActions } from "./thread-actions";
import { useCommentActions, useThreads } from "./use-comments";
import { usePeople } from "./use-people";

export interface CommentsPanelProps {
	collectionId: string;
	/** The folder, request or example shown; `null` for the collection. */
	nodeId: string | null;
	workspaceId: string;
}

/** The threads on the shown item, a new-thread box and "Show resolved". */
export function CommentsPanel({
	collectionId,
	nodeId,
	workspaceId,
}: CommentsPanelProps) {
	const t = useT();
	const toggleId = useId();
	const errorText = useCommentErrorMessage();
	const [showResolved, setShowResolved] = useState(false);
	const [focusedId, setFocusedId] = useState<string | null>(null);
	const threads = useThreads(collectionId, nodeId, showResolved);
	const people = usePeople(workspaceId);
	const { actions, confirm } = useThreadActions(collectionId, nodeId);
	const create = useCommentActions(collectionId).create;
	const focus = useCommentFocus();

	// A link or a marker points at a thread here: show it and scroll to it.
	useEffect(() => {
		if (!focus || focus.collectionId !== collectionId) return;
		if (focus.nodeId !== nodeId || !threads.data) return;
		const thread = threads.data.find((item) =>
			item.comments.some((comment) => comment.id === focus.commentId),
		);
		if (!thread && !showResolved) {
			setShowResolved(true);
			return;
		}
		clearCommentFocus();
		if (!thread) return;
		setFocusedId(thread.id);
		document
			.querySelector(`[data-thread-id="${thread.id}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [focus, collectionId, nodeId, threads.data, showResolved]);

	return (
		<div data-id="comments-panel" className="grid gap-3">
			<div className="flex items-center gap-2">
				<span className="flex-1 text-muted text-xs">
					{t("collections.comments.count", {
						count: threads.data?.length ?? 0,
					})}
				</span>
				<input
					id={toggleId}
					type="checkbox"
					checked={showResolved}
					data-id="comments-show-resolved"
					className="size-4 accent-primary"
					onChange={(event) => setShowResolved(event.target.checked)}
				/>
				<label htmlFor={toggleId} className="text-xs">
					{t("collections.comments.showResolved")}
				</label>
			</div>
			{threads.isPending ? (
				<SkeletonRegion label={t("collections.comments.loading")}>
					<Skeleton className="h-20" />
				</SkeletonRegion>
			) : threads.isError ? (
				<Alert tone="danger">
					{t("collections.comments.loadFailed")}{" "}
					<Button
						size="sm"
						variant="ghost"
						onClick={() => void threads.refetch()}
					>
						{t("common.cta.retry")}
					</Button>
				</Alert>
			) : threads.data.length === 0 ? (
				<p data-id="comments-empty" className="m-0 text-muted text-sm">
					{t("collections.comments.empty")}
				</p>
			) : (
				<ol className="m-0 grid list-none gap-3 p-0">
					{threads.data.map((thread) => (
						<CommentThread
							key={thread.id}
							thread={thread}
							people={people}
							actions={actions}
							focused={thread.id === focusedId}
						/>
					))}
				</ol>
			)}
			<div data-id="comments-composer" className="grid gap-1">
				<CommentComposer
					label={t("collections.comments.composerLabel")}
					placeholder={t("collections.comments.composerPlaceholder")}
					submitLabel={t("collections.comments.send")}
					people={people}
					dataId="comments-composer"
					onSubmit={async (body) => {
						await create.mutateAsync({ nodeId, body });
					}}
				/>
				{create.isError ? (
					<Alert tone="danger">{errorText(create.error)}</Alert>
				) : null}
				<p className="m-0 text-muted text-xs">
					{t("collections.comments.help")}
				</p>
			</div>
			{confirm}
		</div>
	);
}
