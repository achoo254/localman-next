import { NODE_PARAM } from "../sharing/open-element-state";
import { elementPath } from "../sharing/sharing-api";

/** Query parameter of a link to one comment. */
export const COMMENT_PARAM = "comment";

/** Path of a link to a comment on the collection or one of its items. */
export function commentLinkPath(
	collectionId: string,
	nodeId: string | null,
	commentId: string,
): string {
	const query = new URLSearchParams();
	if (nodeId !== null) query.set(NODE_PARAM, nodeId);
	query.set(COMMENT_PARAM, commentId);
	return `${elementPath("collection", collectionId)}?${query.toString()}`;
}
