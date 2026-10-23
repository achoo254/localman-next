import type { CollectionDetail } from "@localman/shared/api-client";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Switch } from "../../components/ui/switch";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import type { SyncStatus } from "./live-mock-sync-api";
import { useSyncActions } from "./use-live-mock-sync";

export interface SyncSettingsDialogProps {
	detail: CollectionDetail;
	sync: SyncStatus;
	onClose: () => void;
}

/**
 * What the collection follows and how; Editors of both the project and
 * the collection turn the sync off (one way: it is turned on by making a
 * synced collection from the project).
 */
export function SyncSettingsDialog({
	detail,
	sync,
	onClose,
}: SyncSettingsDialogProps) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const { stop } = useSyncActions(detail.id);
	const [enabled, setEnabled] = useState(true);
	const toggleId = useId();
	const save = () => {
		if (enabled) {
			onClose();
			return;
		}
		stop.mutate(undefined, {
			onSuccess: () => {
				toast.show({
					tone: "info",
					title: t("liveMockSync.settings.stopped", { name: detail.name }),
				});
				onClose();
			},
		});
	};
	const environment = detail.relatedEnvironment;
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("liveMockSync.settings.title", { name: detail.name })}
			size="md"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						data-id="modal-sync-settings-save"
						disabled={!sync.canManage}
						loading={stop.isPending}
						onClick={save}
					>
						{t("liveMockSync.settings.save")}
					</Button>
				</ModalFooter>
			}
		>
			<div data-id="modal-sync-settings" className="grid gap-4 text-sm">
				{sync.canManage ? null : (
					<Alert tone="info" data-id="modal-sync-settings-need-editor">
						{t("liveMockSync.settings.needEditor")}
					</Alert>
				)}
				{sync.mockUrlChanged ? (
					<Alert tone="warning" data-id="modal-sync-settings-url-changed">
						{t("liveMockSync.settings.urlChanged")}
					</Alert>
				) : null}
				<div className="flex items-start justify-between gap-3">
					<div className="grid gap-1">
						<strong id={toggleId}>{t("liveMockSync.settings.toggle")}</strong>
						<span className="text-muted text-xs">
							{t("liveMockSync.settings.toggleHint")}
						</span>
					</div>
					<Switch
						checked={enabled}
						disabled={!sync.canManage}
						aria-labelledby={toggleId}
						data-id="modal-sync-settings-enabled"
						onCheckedChange={setEnabled}
					/>
				</div>
				<dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
					<dt className="text-muted">{t("liveMockSync.settings.project")}</dt>
					<dd
						className="m-0 min-w-0 truncate"
						data-id="modal-sync-settings-project"
					>
						{sync.project?.name ?? t("liveMockSync.settings.projectHidden")}
					</dd>
					<dt className="text-muted">
						{t("liveMockSync.settings.environment")}
					</dt>
					<dd
						className="m-0 grid min-w-0 gap-1"
						data-id="modal-sync-settings-env"
					>
						<span className="truncate">
							{environment?.name ?? t("liveMockSync.settings.noEnvironment")}
						</span>
						<span className="text-muted text-xs">
							{t("liveMockSync.settings.environmentHint")}
						</span>
					</dd>
				</dl>
				<p className="m-0 text-muted text-xs">
					{t("liveMockSync.settings.lastSynced", {
						time: formatDate(sync.lastSyncedAt),
					})}
				</p>
				<p className="m-0 text-muted text-xs">
					{t("liveMockSync.settings.behaviour")}
				</p>
				{stop.isError ? (
					<Alert tone="danger">{errorMessage(stop.error)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
