/**
 * Inline comments in the request editor, provided by the collections
 * workbench for a tab bound to a saved request: the editor marks what can
 * be commented on and asks here for markers, highlights and head buttons.
 */
import type { Extension } from "@codemirror/state";
import { type ReactNode, createContext, useContext } from "react";
import type { WorkbenchTab } from "../workbench/workbench-types";

export type CommentRowPart = "params" | "headers";
export type CommentCodePart = "body" | "preScript" | "postScript";

export interface InlineCommenting {
	/** Marker of a params or headers row with open threads, if any. */
	rowMarker(part: CommentRowPart, rowId: string): ReactNode;
	/** Highlights of the anchored text in that code editor. */
	codeExtension(part: CommentCodePart): Extension | undefined;
	/** Comments count and "Comment on selection", for the request head. */
	head: ReactNode;
}

export const InlineCommentingContext = createContext<InlineCommenting | null>(
	null,
);

export function useInlineCommenting(): InlineCommenting | null {
	return useContext(InlineCommentingContext);
}

/** Wraps the editor of a tab with inline comments, when it has them. */
export type InlineCommentHost = (
	tab: WorkbenchTab,
	editor: ReactNode,
) => ReactNode;

export const InlineCommentHostContext = createContext<InlineCommentHost | null>(
	null,
);
