import type { CollectionNode } from "@localman/shared/api-client";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { previewNodeDelete } from "./bulk-api";
import { translatedError } from "./collection-errors";
import { IrreversibleNote, useIrreversible } from "./irreversible-note";
import { useDeleteNode } from "./use-node-mutations";

export interface DeleteNodeModalProps {
	collectionId: string;
	node: CollectionNode;
	/** Requests inside a folder (counted from the loaded tree). */
	requestCount: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCloseAutoFocus?: (event: Event) => void;
}

/** Deletes a folder (with everything inside), a request or an example, for good. */
export function DeleteNodeModal({
	collectionId,
	node,
	requestCount,
	open,
	onOpenChange,
	onCloseAutoFocus,
}: DeleteNodeModalProps) {
	const t = useT();
	const toast = useToast();
	const remove = useDeleteNode();
	const folder = node.kind === "folder";
	const preview = useIrreversible(
		["node-delete", collectionId, node.id],
		() => previewNodeDelete(collectionId, node.id),
		open,
	);

	const confirm = async (): Promise<void> => {
		try {
			await remove.mutateAsync({ collectionId, nodeId: node.id });
		} catch (error) {
			throw translatedError(error, t);
		}
		toast.show({
			tone: "success",
			title: t("collections.toast.nodeDeleted", { name: node.name }),
		});
	};

	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t(`collections.deleteNode.${node.kind}Title`)}
			question={t("collections.deleteNode.question", { name: node.name })}
			confirmLabel={t("collections.deleteNode.confirm")}
			onConfirm={confirm}
			confirmDisabled={preview.pending}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-delete-node"
		>
			<p className="m-0">
				{folder
					? t("collections.deleteNode.folderBody", { count: requestCount })
					: t(
							`collections.deleteNode.${node.kind === "example" ? "example" : "request"}Body`,
						)}
			</p>
			<IrreversibleNote show={preview.irreversible} />
		</ConfirmModal>
	);
}
