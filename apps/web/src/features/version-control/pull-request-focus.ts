/**
 * The pull request shown: set by a notification or comment link, or by a
 * click in the Pull requests panel; the rail of that collection opens the
 * panel, which shows it until closed. Kept outside the panel, so it stays
 * open when a merge refreshes the page under it.
 */
import { useSyncExternalStore } from "react";

export interface PullRequestFocus {
	collectionId: string;
	pullRequestId: string;
	/** A comment of it to bring into view. */
	commentId: string | null;
}

let current: PullRequestFocus | null = null;
const listeners = new Set<() => void>();

function emit(): void {
	for (const listener of listeners) listener();
}

export function focusPullRequest(focus: PullRequestFocus): void {
	current = focus;
	emit();
}

export function clearPullRequestFocus(): void {
	if (current === null) return;
	current = null;
	emit();
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function usePullRequestFocus(): PullRequestFocus | null {
	return useSyncExternalStore(
		subscribe,
		() => current,
		() => null,
	);
}
