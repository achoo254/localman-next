import type { ConflictSide } from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { ConflictList } from "../version-control/conflict-list";
import { useSyncActions, useSyncConflictsPreview } from "./use-live-mock-sync";

export interface SyncConflictDialogProps {
	collectionId: string;
	/** The mock project's name, or the collection's when it is hidden. */
	sourceName: string;
	onClose: () => void;
}

/**
 * The fields the mock changed where the user had edited them: for each,
 * "Take from mock" or "Keep mine" (the conflict resolver of forks, with
 * the sync's own words), then the mock's changes are applied.
 */
export function SyncConflictDialog({
	collectionId,
	sourceName,
	onClose,
}: SyncConflictDialogProps) {
	const t = useT();
	const toast = useToast();
	const preview = useSyncConflictsPreview(collectionId, true);
	const { resolve } = useSyncActions(collectionId);
	const [choices, setChoices] = useState<Record<string, ConflictSide>>({});
	const conflicts = preview.data?.conflicts ?? [];
	const left = conflicts.filter((conflict) => !choices[conflict.id]).length;
	const nothing = preview.data !== undefined && conflicts.length === 0;
	const submit = () =>
		resolve.mutate(choices, {
			onSuccess: () => {
				toast.show({
					tone: "success",
					title: t("liveMockSync.conflicts.done", { name: sourceName }),
				});
				onClose();
			},
		});
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("liveMockSync.conflicts.title", { name: sourceName })}
			description={t("liveMockSync.conflicts.intro")}
			size="xl"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						data-id="modal-sync-conflicts-submit"
						loading={resolve.isPending}
						disabled={!preview.data || nothing || left > 0}
						onClick={submit}
					>
						{t("liveMockSync.conflicts.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<div data-id="modal-sync-conflicts" className="grid gap-4">
				{preview.isPending ? (
					<SkeletonRegion label={t("liveMockSync.conflicts.loading")}>
						<Skeleton className="h-24" />
					</SkeletonRegion>
				) : preview.isError ? (
					<Alert tone="danger">{errorMessage(preview.error)}</Alert>
				) : nothing ? (
					<p className="m-0 text-muted text-sm">
						{t("liveMockSync.conflicts.nothing")}
					</p>
				) : (
					<ConflictList
						conflicts={conflicts}
						choices={choices}
						onChoose={setChoices}
						sides={t("liveMockSync.conflicts.sides")}
						labels={{
							source: t("liveMockSync.conflicts.keepMock"),
							destination: t("liveMockSync.conflicts.keepMine"),
							allSource: t("liveMockSync.conflicts.allMock"),
							allDestination: t("liveMockSync.conflicts.allMine"),
						}}
					/>
				)}
				{left > 0 ? (
					<p className="m-0 text-muted text-xs" data-id="conflicts-left">
						{t("versionControl.conflicts.left", { count: left })}
					</p>
				) : null}
				{resolve.isError ? (
					<Alert tone="danger">{errorMessage(resolve.error)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
