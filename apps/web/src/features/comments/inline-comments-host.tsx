import type {
	CommentAnchor,
	CommentThreadView,
	TabSource,
} from "@localman/shared/api-client";
import { IconMessageCircle, IconMessagePlus } from "@tabler/icons-react";
import {
	type ReactNode,
	type SyntheticEvent,
	useCallback,
	useMemo,
	useState,
} from "react";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { useT } from "../../i18n/i18n-context";
import { selectionAt } from "../api-client/request/comment-selection";
import {
	type CommentCodePart,
	type InlineCommenting,
	InlineCommentingContext,
} from "../api-client/request/inline-comment-context";
import { useRightPanel } from "../collections/right-panel-context";
import { type AnchorRange, anchorHighlight } from "./anchor-highlight";
import { focusComment } from "./comment-focus";
import { InlineCommentModal } from "./inline-comment-modal";
import { useThreads } from "./use-comments";

export interface InlineCommentsHostProps {
	source: TabSource;
	/** The tab has unsaved edits: offsets would not match the saved request. */
	dirty: boolean;
	children: ReactNode;
}

const live = (threads: readonly CommentThreadView[]) =>
	threads.filter((thread) => thread.anchor && !thread.anchor.outdated);

/**
 * Inline comments of a request bound to a collection: remembers the last
 * selection in a commentable part, offers "Comment on selection" while the
 * tab matches the saved request, and marks commented rows and text.
 */
export function InlineCommentsHost({
	source,
	dirty,
	children,
}: InlineCommentsHostProps) {
	const t = useT();
	const { setPanel } = useRightPanel();
	const { collectionId, nodeId } = source;
	const [selection, setSelection] = useState<CommentAnchor | null>(null);
	const [asking, setAsking] = useState<CommentAnchor | null>(null);
	const threads = useThreads(collectionId, nodeId, false);
	const open = useCallback(
		(threadId: string) => {
			focusComment({ collectionId, nodeId, commentId: threadId });
			setPanel("comments");
		},
		[collectionId, nodeId, setPanel],
	);
	// Only events in a commentable part change it: pressing the button
	// below must not clear the selection it is about to use.
	const track = (event: SyntheticEvent) => {
		const { target } = event;
		if (target instanceof Element && target.closest("[data-comment-part]")) {
			setSelection(selectionAt(target));
		}
	};

	const commenting = useMemo<InlineCommenting>(() => {
		const anchored = dirty ? [] : live(threads.data ?? []);
		const codeExtension = (part: CommentCodePart) => {
			const ranges: AnchorRange[] = anchored.flatMap((thread) =>
				thread.anchor?.part === part
					? [
							{
								from: thread.anchor.start,
								to: thread.anchor.end,
								threadId: thread.id,
								title: thread.comments[0]?.authorName ?? "",
							},
						]
					: [],
			);
			return ranges.length > 0 ? anchorHighlight(ranges, open) : undefined;
		};
		const rowMarker = (part: string, rowId: string) => {
			const first = anchored.find(
				(thread) =>
					thread.anchor?.part === part && thread.anchor.rowId === rowId,
			);
			return first ? (
				<IconButton
					size="sm"
					variant="ghost"
					data-id={`request-${part}-comment-marker`}
					label={t("collections.comments.rowMarker")}
					icon={<IconMessageCircle size={14} aria-hidden="true" />}
					onClick={() => open(first.id)}
				/>
			) : null;
		};
		const count = threads.data?.length ?? 0;
		const canComment = selection !== null && !dirty;
		const head = (
			<>
				<Button
					size="sm"
					variant="ghost"
					data-id="request-head-comments"
					onClick={() => setPanel("comments")}
				>
					<IconMessageCircle size={16} aria-hidden="true" />
					{t("collections.comments.requestCount", { count })}
				</Button>
				<IconButton
					size="sm"
					variant="ghost"
					data-id="request-comment-selection"
					label={t("collections.comments.inline.button")}
					title={
						dirty
							? t("collections.comments.inline.unsaved")
							: t("collections.comments.inline.hint")
					}
					disabled={!canComment}
					icon={<IconMessagePlus size={16} aria-hidden="true" />}
					onClick={() => setAsking(selection)}
				/>
			</>
		);
		return { codeExtension, rowMarker, head };
	}, [threads.data, dirty, selection, t, open, setPanel]);

	return (
		<InlineCommentingContext value={commenting}>
			<div onSelect={track} onMouseUp={track} onKeyUp={track}>
				{children}
			</div>
			{asking ? (
				<InlineCommentModal
					source={source}
					anchor={asking}
					onClose={() => setAsking(null)}
					onCreated={(threadId) => {
						setAsking(null);
						open(threadId);
					}}
				/>
			) : null}
		</InlineCommentingContext>
	);
}
