import { useEffect } from "react";
import { useCommentFocus } from "../comments/comment-focus";
import { usePullRequestFocus } from "../version-control/pull-request-focus";
import type { RightPanel } from "./right-panel-context";

/**
 * Opens the panel a link points at: the Comments panel for a comment on
 * the shown item, the Pull requests panel for a pull request into this
 * collection (the panels then bring the comment or pull request up).
 */
export function useRailFocus(
	target: { collectionId: string; nodeId: string | null },
	enabled: { comments: boolean; forks: boolean },
	setPanel: (panel: RightPanel) => void,
): void {
	const { collectionId, nodeId } = target;
	const comment = useCommentFocus();
	const pullRequest = usePullRequestFocus();
	useEffect(() => {
		if (!enabled.comments || !comment) return;
		if (comment.collectionId === collectionId && comment.nodeId === nodeId) {
			setPanel("comments");
		}
	}, [enabled.comments, comment, collectionId, nodeId, setPanel]);
	useEffect(() => {
		if (enabled.forks && pullRequest?.collectionId === collectionId) {
			setPanel("pullRequests");
		}
	}, [enabled.forks, pullRequest, collectionId, setPanel]);
}
