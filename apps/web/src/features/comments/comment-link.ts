import { NODE_PARAM } from "../sharing/open-element-state";
import { elementPath } from "../sharing/sharing-api";

/** Query parameter of a link to one comment. */
export const COMMENT_PARAM = "comment";

/** Query parameter of a link to one pull request of a collection. */
export const PULL_REQUEST_PARAM = "pr";

/**
 * Path of a link to a comment on the collection, one of its items, or a
 * pull request into it.
 */
export function commentLinkPath(
	collectionId: string,
	nodeId: string | null,
	commentId: string,
	pullRequestId: string | null = null,
): string {
	const query = new URLSearchParams();
	if (pullRequestId !== null) query.set(PULL_REQUEST_PARAM, pullRequestId);
	else if (nodeId !== null) query.set(NODE_PARAM, nodeId);
	query.set(COMMENT_PARAM, commentId);
	return `${elementPath("collection", collectionId)}?${query.toString()}`;
}
