import type { CommentAnchor, TabSource } from "@localman/shared/api-client";
import { Alert } from "../../components/ui/alert";
import { Modal } from "../../components/ui/modal";
import { useT } from "../../i18n/i18n-context";
import { useCollection } from "../collections/use-collections";
import { AnchorLabel } from "./anchor-label";
import { CommentComposer } from "./comment-composer";
import { useCommentErrorMessage } from "./comment-errors";
import { useCommentActions } from "./use-comments";
import { usePeople } from "./use-people";

export interface InlineCommentModalProps {
	source: TabSource;
	anchor: CommentAnchor;
	onClose: () => void;
	/** The new thread, to show it. */
	onCreated: (threadId: string) => void;
}

/** "Comment on the selection": the quoted text and a comment box. */
export function InlineCommentModal({
	source,
	anchor,
	onClose,
	onCreated,
}: InlineCommentModalProps) {
	const t = useT();
	const errorText = useCommentErrorMessage();
	const create = useCommentActions(source.collectionId).create;
	const collection = useCollection(source.collectionId);
	const people = usePeople(collection.data?.workspaceId ?? null);
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("collections.comments.inline.title")}
			size="md"
		>
			<div data-id="modal-inline-comment" className="grid gap-3">
				<AnchorLabel anchor={anchor} />
				<CommentComposer
					label={t("collections.comments.composerLabel")}
					submitLabel={t("collections.comments.send")}
					people={people}
					dataId="modal-inline-comment"
					autoFocus
					onCancel={onClose}
					onSubmit={async (body) => {
						const created = await create.mutateAsync({
							nodeId: source.nodeId,
							body,
							anchor,
						});
						onCreated(created.threadId);
					}}
				/>
				{create.isError ? (
					<Alert tone="danger">{errorText(create.error)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
