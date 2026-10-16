/**
 * The comment thread to bring into view: set by a notification link or a
 * marker in the request editor, read by the Comments panel of the right
 * rail, which opens itself, scrolls to the thread and clears it.
 */
import { useSyncExternalStore } from "react";

export interface CommentFocus {
	collectionId: string;
	/** `null` for the collection itself. */
	nodeId: string | null;
	/** A thread or one of its comments. */
	commentId: string;
}

let current: CommentFocus | null = null;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

export function focusComment(focus: CommentFocus): void {
	current = focus;
	emit();
}

export function clearCommentFocus(): void {
	if (current === null) return;
	current = null;
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function useCommentFocus(): CommentFocus | null {
	return useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	);
}
