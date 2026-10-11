import {
	type CollectionSummary,
	DELETE_CONFIRMATION,
} from "@localman/shared/api-client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { translatedError } from "./collection-errors";
import { previewTrash } from "./trash-api";
import { useTrashCollection } from "./use-collection-mutations";
import { collectionKey } from "./use-collections";
import { useTrashDays } from "./use-trash";

export interface DeleteCollectionModalProps {
	summary: CollectionSummary;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCloseAutoFocus?: (event: Event) => void;
}

/**
 * Moves a collection to the Trash. One holding requests asks for the word
 * `delete` first; an empty one only for the click.
 */
export function DeleteCollectionModal({
	summary,
	open,
	onOpenChange,
	onCloseAutoFocus,
}: DeleteCollectionModalProps) {
	const t = useT();
	const toast = useToast();
	const days = useTrashDays();
	const trash = useTrashCollection();
	const [word, setWord] = useState("");
	// The list may be stale: the server says now whether requests go too.
	const preview = useQuery({
		queryKey: [...collectionKey(summary.id), "trash-preview"],
		queryFn: () => previewTrash(summary.id),
		enabled: open,
		staleTime: 0,
		gcTime: 0,
	});
	const requests = preview.data?.requests ?? summary.requestCount;
	const needsWord = requests > 0;
	const confirmed =
		!needsWord || word.trim().toLowerCase() === DELETE_CONFIRMATION;

	const confirm = async (): Promise<void> => {
		try {
			await trash.mutateAsync({
				summary,
				confirm: needsWord ? DELETE_CONFIRMATION : undefined,
			});
		} catch (error) {
			throw translatedError(error, t);
		}
		toast.show({
			tone: "success",
			title: t("collections.toast.trashed", { name: summary.name }),
		});
	};

	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t("collections.deleteCollection.title")}
			question={
				needsWord
					? t("collections.deleteCollection.body", {
							name: summary.name,
							count: requests,
						})
					: t("collections.deleteCollection.bodyEmpty", { name: summary.name })
			}
			confirmLabel={t("collections.deleteCollection.submit")}
			confirmDisabled={!confirmed || preview.isPending}
			onConfirm={confirm}
			onCloseAutoFocus={onCloseAutoFocus}
			data-id="modal-delete-collection"
		>
			<p className="m-0">
				{t("collections.deleteCollection.kept", { count: days })}
			</p>
			{needsWord ? (
				<FormField
					label={renderRich(
						t("collections.deleteCollection.typeLabel", {
							word: DELETE_CONFIRMATION,
						}),
					)}
					className="mt-2"
				>
					<Input
						value={word}
						autoComplete="off"
						spellCheck={false}
						data-id="modal-delete-collection-input"
						onChange={(event) => setWord(event.target.value)}
					/>
				</FormField>
			) : null}
		</ConfirmModal>
	);
}
