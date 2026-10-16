import type {
	ConflictSide,
	MergeOption,
	PullRequestDetail,
} from "@localman/shared/api-client";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import { SyncChoices } from "./sync-choices";
import { usePullRequestActions } from "./use-pull-requests";

export interface PullRequestMergeDialogProps {
	pullRequest: PullRequestDetail & {
		preview: NonNullable<PullRequestDetail["preview"]>;
	};
	/** Editor of the fork: the two other merge options. */
	canEditFork: boolean;
	onClose: () => void;
	onMerged: () => void;
}

/** The merge of a pull request: its conflicts and what follows. */
export function PullRequestMergeDialog({
	pullRequest,
	canEditFork,
	onClose,
	onMerged,
}: PullRequestMergeDialogProps) {
	const t = useT();
	const toast = useToast();
	const errorText = useForkErrorMessage();
	const { merge } = usePullRequestActions(pullRequest.id);
	const [choices, setChoices] = useState<Record<string, ConflictSide>>({});
	const [option, setOption] = useState<MergeOption>("merge");
	const { preview } = pullRequest;
	const left = preview.conflicts.filter(
		(conflict) => !choices[conflict.id],
	).length;
	const name = pullRequest.sourceName ?? "";
	const submit = () =>
		merge.mutate(
			{
				option,
				resolutions: choices,
				sourceId: pullRequest.sourceId,
				forkId: pullRequest.forkId,
			},
			{
				onSuccess: ({ followUpFailed }) => {
					toast.show(
						followUpFailed
							? { tone: "info", title: t("versionControl.sync.followUpFailed") }
							: {
									tone: "success",
									title: t("versionControl.pullRequests.mergeDone", { name }),
								},
					);
					onMerged();
				},
			},
		);
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
			title={t("versionControl.pullRequests.mergeTitle", {
				title: pullRequest.title,
			})}
			description={t("versionControl.sync.mergeIntro")}
			size="xl"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						data-id="modal-pull-request-merge-submit"
						loading={merge.isPending}
						disabled={left > 0}
						onClick={submit}
					>
						{t("versionControl.sync.submitMerge")}
					</Button>
				</ModalFooter>
			}
		>
			<div data-id="modal-pull-request-merge" className="grid gap-4">
				<SyncChoices
					preview={preview}
					choices={choices}
					onChoose={setChoices}
					sides={t("versionControl.conflicts.mergeSides", { name })}
					merge={{ option, onOption: setOption, canEditFork }}
				/>
				{left > 0 ? (
					<p className="m-0 text-muted text-xs" data-id="conflicts-left">
						{t("versionControl.conflicts.left", { count: left })}
					</p>
				) : null}
				{merge.isError ? (
					<Alert tone="danger">{errorText(merge.error)}</Alert>
				) : null}
			</div>
		</Modal>
	);
}
