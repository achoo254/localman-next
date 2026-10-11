import { DELETE_CONFIRMATION } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { renderRich } from "../../i18n/rich-text";
import { ApiError } from "../../lib/api-client";
import type { BulkPlan } from "./bulk-plan";
import { BulkStopped, previewBulk, runBulk } from "./bulk-run";
import { collectionErrorMessage } from "./collection-errors";
import { IrreversibleNote, useIrreversible } from "./irreversible-note";
import { COLLECTIONS_KEY } from "./use-collections";

export interface BulkDeleteModalProps {
	workspaceId: string;
	plan: BulkPlan;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDone: () => void;
}

/**
 * Deletes the selection: collections to the trash (typing `delete` when
 * they hold requests), nodes for good, one call per collection in order.
 * When a call fails, what went before stays deleted and the dialog says so.
 */
export function BulkDeleteModal({
	workspaceId,
	plan,
	open,
	onOpenChange,
	onDone,
}: BulkDeleteModalProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const [word, setWord] = useState("");
	const preview = useIrreversible(
		[
			"bulk",
			plan.total,
			...plan.collections.map((c) => c.id),
			...plan.nodes.keys(),
		],
		() => previewBulk(workspaceId, plan),
		open,
	);
	const listed = plan.collections.reduce((sum, c) => sum + c.requestCount, 0);
	const needsWord = (preview.data?.requests ?? listed) > 0;
	const nodeCount = plan.total - plan.collections.length;

	const confirm = async (): Promise<void> => {
		let done = 0;
		try {
			done = await runBulk(workspaceId, plan, needsWord);
		} catch (error) {
			const stopped = error instanceof BulkStopped ? error : null;
			const cause = stopped?.reason ?? error;
			const reason = collectionErrorMessage(cause, t);
			const status = cause instanceof ApiError ? cause.status : 0;
			const counts = { done: stopped?.done ?? 0, total: plan.total, reason };
			throw new ApiError(
				status,
				"BULK_PARTIAL",
				t("collections.bulk.partial", counts),
			);
		} finally {
			void client.invalidateQueries({ queryKey: COLLECTIONS_KEY });
		}
		toast.show({
			tone: "success",
			title: t("collections.bulk.done", { count: done }),
		});
		onDone();
	};

	return (
		<ConfirmModal
			open={open}
			onOpenChange={onOpenChange}
			title={t("collections.bulk.title")}
			question={t("collections.bulk.selected", { count: plan.total })}
			confirmLabel={t("collections.bulk.confirm")}
			confirmDisabled={
				preview.pending ||
				(needsWord && word.trim().toLowerCase() !== DELETE_CONFIRMATION)
			}
			onConfirm={confirm}
			data-id="modal-bulk-delete"
		>
			{plan.collections.length > 0 ? (
				<p className="m-0">
					{t("collections.bulk.collections", {
						count: plan.collections.length,
					})}
				</p>
			) : null}
			{nodeCount > 0 ? (
				<p className="m-0">
					{t("collections.bulk.nodes", { count: nodeCount })}
				</p>
			) : null}
			<IrreversibleNote show={preview.irreversible} />
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
						data-id="modal-bulk-delete-input"
						onChange={(event) => setWord(event.target.value)}
					/>
				</FormField>
			) : null}
		</ConfirmModal>
	);
}
