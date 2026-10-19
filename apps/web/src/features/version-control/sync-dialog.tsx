import type { ConflictSide, MergeOption } from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import type { ForkTarget } from "./forks-api";
import { SyncChoices } from "./sync-choices";
import { useForkActions, useSyncPreview } from "./use-forks";

export interface SyncDialogProps {
	/** The fork being pulled into, or merged from. */
	fork: ForkTarget;
	direction: "pull" | "merge";
	source: { id: string; name: string };
	/** Editor of the fork: the two other merge options. */
	canEditFork: boolean;
	/** Editor of the source: merging into it at all (merge only). */
	canMergeIntoSource?: boolean;
	onClose: () => void;
}

/** Pull changes into a fork, or merge it into its source. */
export function SyncDialog({
	fork,
	direction,
	source,
	canEditFork,
	canMergeIntoSource = false,
	onClose,
}: SyncDialogProps) {
	const t = useT();
	const toast = useToast();
	const errorText = useForkErrorMessage();
	const preview = useSyncPreview(fork, direction, true);
	const { sync } = useForkActions(fork);
	const [choices, setChoices] = useState<Record<string, ConflictSide>>({});
	const [option, setOption] = useState<MergeOption>("merge");
	const pull = direction === "pull";
	const blocked = !pull && !canMergeIntoSource;
	const conflicts = preview.data?.conflicts ?? [];
	const left = conflicts.filter((conflict) => !choices[conflict.id]).length;
	const nothing =
		preview.data !== undefined &&
		preview.data.changes.length === 0 &&
		conflicts.length === 0;
	const submit = () =>
		sync.mutate(
			{ direction, resolutions: choices, option, sourceId: source.id },
			{
				onSuccess: ({ followUpFailed }) => {
					if (followUpFailed) {
						toast.show({
							tone: "info",
							title: t("versionControl.sync.followUpFailed"),
						});
						onClose();
						return;
					}
					toast.show({
						tone: "success",
						title: t(
							pull
								? "versionControl.sync.pullDone"
								: "versionControl.sync.mergeDone",
							{ name: source.name },
						),
					});
					onClose();
				},
			},
		);
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t(
				pull
					? "versionControl.sync.pullTitle"
					: "versionControl.sync.mergeTitle",
				{ name: source.name },
			)}
			description={t(
				pull
					? "versionControl.sync.pullIntro"
					: "versionControl.sync.mergeIntro",
			)}
			size="xl"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						data-id={pull ? "modal-pull-submit" : "modal-merge-submit"}
						loading={sync.isPending}
						disabled={!preview.data || nothing || left > 0 || blocked}
						onClick={submit}
					>
						{t(
							pull
								? "versionControl.sync.submitPull"
								: "versionControl.sync.submitMerge",
						)}
					</Button>
				</ModalFooter>
			}
		>
			<div data-id={pull ? "modal-pull" : "modal-merge"} className="grid gap-4">
				{blocked ? (
					<Alert tone="warning" data-id="modal-merge-needs-editor">
						{t(
							fork.kind === "environment"
								? "versionControl.sync.mergeNeedsEditorEnvironment"
								: "versionControl.sync.mergeNeedsEditor",
							{ name: source.name },
						)}
					</Alert>
				) : null}
				{preview.isPending ? (
					<SkeletonRegion label={t("versionControl.sync.loading")}>
						<Skeleton className="h-24" />
					</SkeletonRegion>
				) : preview.isError ? (
					<Alert tone="danger">{errorText(preview.error)}</Alert>
				) : nothing ? (
					<p className="m-0 text-muted text-sm">
						{t("versionControl.sync.nothing")}
					</p>
				) : (
					<SyncChoices
						preview={preview.data}
						choices={choices}
						onChoose={setChoices}
						sides={t(
							pull
								? "versionControl.conflicts.pullSides"
								: "versionControl.conflicts.mergeSides",
							{ name: source.name },
						)}
						merge={
							pull ? undefined : { option, onOption: setOption, canEditFork }
						}
					/>
				)}
				{left > 0 ? (
					<p className="m-0 text-muted text-xs" data-id="conflicts-left">
						{t("versionControl.conflicts.left", { count: left })}
					</p>
				) : null}
				{sync.isError ? (
					<Alert tone="danger">{errorText(sync.error)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
