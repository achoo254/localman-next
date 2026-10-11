import type {
	CollectionNode,
	CollectionSummary,
} from "@localman/shared/api-client";
import { ShareDialog } from "../sharing/share-dialog";
import { DeleteCollectionModal } from "./delete-collection-modal";
import { DeleteNodeModal } from "./delete-node-modal";
import { MoveCollectionModal } from "./move-collection-modal";

/** The dialog a tree menu opened, with what it acts on. */
export type TreeDialog =
	| { kind: "share" | "move" | "deleteCollection"; summary: CollectionSummary }
	| {
			kind: "deleteNode";
			collectionId: string;
			node: CollectionNode;
			requestCount: number;
	  };

export interface CollectionDialogsProps {
	/** The last dialog opened; kept while it closes, for its animation. */
	dialog: TreeDialog | null;
	open: boolean;
	onClose: () => void;
	/**
	 * Where focus goes once a dialog closes on a row that is gone (deleted,
	 * moved away); the ⋯ button that opened it no longer exists.
	 */
	onFocusAfterRemoval: (event: Event) => void;
}

/** Share, Move and Delete dialogs of the collections tree. */
export function CollectionDialogs({
	dialog,
	open,
	onClose,
	onFocusAfterRemoval,
}: CollectionDialogsProps) {
	if (!dialog) return null;
	const onOpenChange = (next: boolean) => {
		if (!next) onClose();
	};
	switch (dialog.kind) {
		case "share":
			return (
				<ShareDialog
					open={open}
					onOpenChange={onOpenChange}
					elementType="collection"
					elementId={dialog.summary.id}
					elementName={dialog.summary.name}
				/>
			);
		case "move":
			return (
				<MoveCollectionModal
					open={open}
					onOpenChange={onOpenChange}
					summary={dialog.summary}
					onCloseAutoFocus={onFocusAfterRemoval}
				/>
			);
		case "deleteCollection":
			return (
				<DeleteCollectionModal
					open={open}
					onOpenChange={onOpenChange}
					summary={dialog.summary}
					onCloseAutoFocus={onFocusAfterRemoval}
				/>
			);
		case "deleteNode":
			return (
				<DeleteNodeModal
					open={open}
					onOpenChange={onOpenChange}
					collectionId={dialog.collectionId}
					node={dialog.node}
					requestCount={dialog.requestCount}
					onCloseAutoFocus={onFocusAfterRemoval}
				/>
			);
	}
}
