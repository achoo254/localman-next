import { COLLECTION_NAME_MAX } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Select } from "../../components/ui/select";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { tabLabel } from "../api-client/tabs/tab-label";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { WorkbenchTab } from "../api-client/workbench/workbench-types";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { collectionErrorMessage } from "./collection-errors";
import { createNode } from "./collections-api";
import { folderOptions } from "./folder-options";
import {
	COLLECTIONS_KEY,
	useCollection,
	useCollectionList,
} from "./use-collections";

export interface SaveToCollectionModalProps {
	tab: WorkbenchTab;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/** Saves a loose request into a collection (and folder), then binds the tab. */
export function SaveToCollectionModal({
	tab,
	open,
	onOpenChange,
}: SaveToCollectionModalProps) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const { bindTab, updateDraft } = useWorkbenchActions();
	const { current } = useCurrentWorkspace();
	const list = useCollectionList(current?.id ?? null);
	const editable = (list.data ?? []).filter((item) => item.role === "editor");
	const [collectionId, setCollectionId] = useState<string | null>(null);
	const chosen =
		editable.find((item) => item.id === collectionId) ?? editable[0] ?? null;
	const detail = useCollection(chosen?.id ?? "", chosen !== null);
	const folders = detail.data ? folderOptions(detail.data) : [];
	const [folderId, setFolderId] = useState("");
	const nameRef = useRef<HTMLInputElement>(null);
	const [name, setName] = useState(
		() => tabLabel(tab.draft) || t("collections.defaults.request"),
	);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<unknown>(null);

	const submit = async (): Promise<void> => {
		const trimmed = name.trim();
		if (!chosen || !trimmed) return;
		setBusy(true);
		setError(null);
		const draft = { ...tab.draft, name: trimmed };
		try {
			const node = await createNode(chosen.id, {
				kind: "request",
				parentId: folderId || null,
				name: trimmed,
				draft,
			});
			updateDraft(tab.id, (current) =>
				current.name === trimmed ? current : { ...current, name: trimmed },
			);
			bindTab(tab.id, { collectionId: chosen.id, nodeId: node.id }, draft);
			void client.invalidateQueries({ queryKey: COLLECTIONS_KEY });
			toast.show({
				tone: "success",
				title: t("collections.save.saved", {
					name: trimmed,
					collection: chosen.name,
				}),
			});
			onOpenChange(false);
		} catch (cause) {
			setError(cause);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Modal
			open={open}
			onOpenChange={(next) => {
				if (!busy) onOpenChange(next);
			}}
			title={t("collections.save.title")}
			size="md"
			initialFocusRef={nameRef}
			data-id="modal-save-to-collection"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost" disabled={busy}>
							{t("common.actions.cancel")}
						</Button>
					</ModalClose>
					<Button
						variant="primary"
						data-id="modal-save-to-collection-submit"
						loading={busy}
						disabled={!chosen || name.trim() === ""}
						onClick={() => void submit()}
					>
						{t("collections.save.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<div className="grid gap-4">
				<FormField label={t("collections.save.name")}>
					<Input
						ref={nameRef}
						value={name}
						maxLength={COLLECTION_NAME_MAX}
						data-id="modal-save-to-collection-name"
						onChange={(event) => setName(event.target.value)}
					/>
				</FormField>
				{list.isSuccess && editable.length === 0 ? (
					<Alert tone="info">{t("collections.save.noCollection")}</Alert>
				) : (
					<FormField label={t("collections.save.collection")}>
						<Select
							value={chosen?.id ?? ""}
							data-id="modal-save-to-collection-collection"
							onChange={(event) => {
								setCollectionId(event.target.value);
								setFolderId("");
							}}
						>
							{editable.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name}
								</option>
							))}
						</Select>
					</FormField>
				)}
				<FormField label={t("collections.save.folder")}>
					<Select
						value={folderId}
						data-id="modal-save-to-collection-folder"
						disabled={!detail.data}
						onChange={(event) => setFolderId(event.target.value)}
					>
						<option value="">{t("collections.save.top")}</option>
						{folders.map((folder) => (
							<option key={folder.id} value={folder.id}>
								{folder.path}
							</option>
						))}
					</Select>
				</FormField>
				{error ? (
					<Alert tone="danger">{collectionErrorMessage(error, t)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
