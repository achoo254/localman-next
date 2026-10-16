import type { CommentReaction } from "@localman/shared/api-client";
import { type ReactNode, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { appPageUrl } from "../../platform/navigation";
import { useCommentErrorMessage } from "./comment-errors";
import { commentLinkPath } from "./comment-link";
import { useCommentActions } from "./use-comments";

/** What a thread and its comments can do. */
export interface ThreadActions {
	reply(threadId: string, body: string): Promise<void>;
	edit(commentId: string, body: string): Promise<void>;
	/** Asks first; the thread's first comment takes the thread along. */
	remove(commentId: string, wholeThread?: boolean): void;
	resolve(threadId: string, resolved: boolean): void;
	react(commentId: string, reaction: CommentReaction, on: boolean): void;
	copyLink(commentId: string): void;
}

/**
 * The actions of the comments on one item (or on a pull request into the
 * collection), with toasts on failure and the delete confirmation to
 * render next to the threads.
 */
export function useThreadActions(
	collectionId: string,
	nodeId: string | null,
	pullRequestId: string | null = null,
): { actions: ThreadActions; confirm: ReactNode } {
	const t = useT();
	const toast = useToast();
	const errorText = useCommentErrorMessage();
	const writes = useCommentActions(collectionId);
	const [pending, setPending] = useState<{
		id: string;
		thread: boolean;
	} | null>(null);
	const fail = (error: unknown) =>
		toast.show({ tone: "error", title: errorText(error) });
	const run = async (work: Promise<unknown>): Promise<void> => {
		try {
			await work;
		} catch (error) {
			fail(error);
			throw error;
		}
	};
	const actions: ThreadActions = {
		reply: (threadId, body) =>
			run(
				writes.create.mutateAsync({
					nodeId,
					threadId,
					body,
					...(pullRequestId ? { pullRequestId } : {}),
				}),
			),
		edit: (id, body) => run(writes.edit.mutateAsync({ id, body })),
		remove: (id, thread = false) => setPending({ id, thread }),
		resolve: (id, resolved) =>
			writes.resolve.mutate({ id, resolved }, { onError: fail }),
		react: (id, reaction, on) =>
			writes.react.mutate({ id, reaction, on }, { onError: fail }),
		copyLink: (id) =>
			void copyText(
				appPageUrl(commentLinkPath(collectionId, nodeId, id, pullRequestId)),
			).then((ok) =>
				toast.show(
					ok
						? { tone: "success", title: t("collections.comments.linkCopied") }
						: { tone: "error", title: t("collections.comments.linkFailed") },
				),
			),
	};
	const confirm = (
		<ConfirmModal
			open={pending !== null}
			onOpenChange={(open) => {
				if (!open) setPending(null);
			}}
			title={
				pending?.thread
					? t("collections.comments.deleteThreadTitle")
					: t("collections.comments.deleteTitle")
			}
			question={
				pending?.thread
					? t("collections.comments.deleteThreadBody")
					: t("collections.comments.deleteBody")
			}
			confirmLabel={t("collections.comments.delete")}
			onConfirm={async () => {
				if (!pending) return;
				// The modal shows a failure itself and stays open.
				await writes.remove.mutateAsync(pending.id);
				setPending(null);
			}}
		/>
	);
	return { actions, confirm };
}
