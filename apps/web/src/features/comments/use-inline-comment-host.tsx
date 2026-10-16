import { useCallback } from "react";
import type { InlineCommentHost } from "../api-client/request/inline-comment-context";
import { InlineCommentsHost } from "./inline-comments-host";
import { useCommentsEnabled } from "./use-comments-enabled";

/**
 * What wraps a request editor with inline comments: tabs bound to a saved
 * request of a collection get them while comments are on; `null` (no
 * wrapper) otherwise.
 */
export function useInlineCommentHost(): InlineCommentHost | null {
	const enabled = useCommentsEnabled();
	const host = useCallback<InlineCommentHost>(
		(tab, editor) =>
			tab.source ? (
				<InlineCommentsHost source={tab.source} dirty={tab.dirty}>
					{editor}
				</InlineCommentsHost>
			) : (
				editor
			),
		[],
	);
	return enabled ? host : null;
}
