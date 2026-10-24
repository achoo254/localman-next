import {
	IconArrowBackUp,
	IconCloudUpload,
	IconLock,
	IconShare,
} from "@tabler/icons-react";
import { type ReactNode, useState } from "react";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import {
	DropdownMenuItem,
	DropdownMenuLabel,
} from "../../components/ui/dropdown-menu";
import { useT } from "../../i18n/i18n-context";
import type { VariableEditor } from "./use-variable-editor";
import { batchTargets } from "./variable-batch";

type Confirming = "reset" | "unshare" | null;

export interface VariableBulk {
	/** "Share all" … "Unshare all", to put in a More menu. */
	items: ReactNode;
	/** The confirmations of Reset all and Unshare all (outside the menu). */
	dialogs: ReactNode;
}

/**
 * The "all" actions of a variable table: each applies the row action to
 * every row that offers it, in one save. Share all, Update all shared
 * values and Unshare all write shared values (Editors only); Reset all
 * changes the caller's own local values. The two that drop values ask
 * first.
 */
export function useVariableBulk(editor: VariableEditor): VariableBulk {
	const t = useT();
	const [confirming, setConfirming] = useState<Confirming>(null);
	const targets = batchTargets(editor.rows, editor.canEdit);
	const viewerTitle = editor.canEdit
		? undefined
		: t("environments.bulk.editorsOnly");
	// Values locked in the vault cannot be read, so they are never shared.
	const lockedOut = editor.canEdit
		? editor.rows.filter((row) => row.locked).length
		: 0;
	const confirm = async (run: () => void) => {
		run();
		await editor.flush();
	};
	const items = (
		<>
			<DropdownMenuItem
				data-id="vars-more-share-all"
				icon={<IconShare size={16} aria-hidden="true" />}
				disabled={targets.share.length === 0}
				title={viewerTitle}
				onSelect={() => editor.shareRows(targets.share)}
			>
				{t("environments.bulk.shareAll")}
			</DropdownMenuItem>
			<DropdownMenuItem
				data-id="vars-more-update-all"
				icon={<IconCloudUpload size={16} aria-hidden="true" />}
				disabled={targets.update.length === 0}
				title={viewerTitle}
				onSelect={() => editor.shareRows(targets.update)}
			>
				{t("environments.bulk.updateAll")}
			</DropdownMenuItem>
			<DropdownMenuItem
				data-id="vars-more-reset-all"
				icon={<IconArrowBackUp size={16} aria-hidden="true" />}
				disabled={targets.reset.length === 0}
				onSelect={() => setConfirming("reset")}
			>
				{t("environments.bulk.resetAll")}
			</DropdownMenuItem>
			<DropdownMenuItem
				data-id="vars-more-unshare-all"
				icon={<IconLock size={16} aria-hidden="true" />}
				disabled={targets.unshare.length === 0}
				title={viewerTitle}
				onSelect={() => setConfirming("unshare")}
			>
				{t("environments.bulk.unshareAll")}
			</DropdownMenuItem>
			{viewerTitle ? (
				<DropdownMenuLabel data-id="vars-more-editors-only">
					{viewerTitle}
				</DropdownMenuLabel>
			) : null}
			{lockedOut > 0 ? (
				<DropdownMenuLabel data-id="vars-more-locked">
					{t("agentUse.vault.skipped", { count: lockedOut })}
				</DropdownMenuLabel>
			) : null}
		</>
	);
	const close = (open: boolean) => {
		if (!open) setConfirming(null);
	};
	const dialogs = (
		<>
			<ConfirmModal
				open={confirming === "reset"}
				onOpenChange={close}
				data-id="modal-reset-all"
				title={t("environments.bulk.resetAll")}
				question={t("environments.bulk.resetQuestion")}
				confirmLabel={t("environments.bulk.resetAll")}
				onConfirm={() => confirm(() => editor.resetRows(targets.reset))}
			>
				<p className="m-0">
					{t("environments.bulk.resetSummary", {
						count: targets.reset.length,
					})}
				</p>
			</ConfirmModal>
			<ConfirmModal
				open={confirming === "unshare"}
				onOpenChange={close}
				data-id="modal-unshare-all"
				title={t("environments.bulk.unshareAll")}
				question={t("environments.bulk.unshareQuestion")}
				confirmLabel={t("environments.bulk.unshareAll")}
				onConfirm={() => confirm(() => editor.unshareRows(targets.unshare))}
			>
				<p className="m-0">
					{t("environments.bulk.unshareSummary", {
						count: targets.unshare.length,
					})}
				</p>
			</ConfirmModal>
		</>
	);
	return { items, dialogs };
}
