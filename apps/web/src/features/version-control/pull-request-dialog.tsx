import {
	IconArrowMerge,
	IconCheck,
	IconDownload,
	IconPencil,
	IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Modal } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import { PullRequestForm } from "./pull-request-form";
import { PullRequestMergeDialog } from "./pull-request-merge-dialog";
import { PullRequestSummary } from "./pull-request-summary";
import { PullRequestThreads } from "./pull-request-threads";
import { SyncDialog } from "./sync-dialog";
import { usePullRequest, usePullRequestActions } from "./use-pull-requests";

export interface PullRequestDialogProps {
	id: string;
	/** Its members are offered after `@` in comments. */
	workspaceId: string | null;
	/** Editor of its fork (the other merge options). */
	canEditFork: boolean;
	focusedCommentId: string | null;
	onClose: () => void;
}

/** A pull request: what it changes, its reviews, discussion and merge. */
export function PullRequestDialog(props: PullRequestDialogProps) {
	const t = useT();
	const toast = useToast();
	const errorText = useForkErrorMessage();
	const query = usePullRequest(props.id);
	const { review } = usePullRequestActions(props.id);
	const [step, setStep] = useState<"edit" | "pull" | "merge" | null>(null);
	const pr = query.data;
	const decide = (decision: "approved" | "declined") =>
		review.mutate(decision, {
			onSuccess: () =>
				toast.show({
					tone: "success",
					title: t(
						decision === "approved"
							? "versionControl.pullRequests.approvedDone"
							: "versionControl.pullRequests.declinedDone",
					),
				}),
		});
	const mergeable = pr?.preview ? { ...pr, preview: pr.preview } : null;
	return (
		<>
			<Modal
				open
				onOpenChange={(open) => {
					// Closing the edit or merge dialog on top closes only that one.
					if (!open && step === null) props.onClose();
				}}
				title={pr?.title ?? t("versionControl.pullRequests.loading")}
				size="xl"
				footer={
					pr ? (
						<ModalFooter>
							{pr.canEdit ? (
								<Button
									variant="ghost"
									data-id="pull-request-edit"
									onClick={() => setStep("edit")}
								>
									<IconPencil size={16} aria-hidden="true" />
									{t("versionControl.pullRequests.edit")}
								</Button>
							) : null}
							{pr.canEdit && pr.forkLabel && pr.sourceName ? (
								<Button
									variant="ghost"
									data-id="pull-request-pull-updates"
									onClick={() => setStep("pull")}
								>
									<IconDownload size={16} aria-hidden="true" />
									{t("versionControl.pullRequests.pullUpdates")}
								</Button>
							) : null}
							{pr.canReview ? (
								<>
									<Button
										variant="secondary"
										data-id="pull-request-decline"
										loading={
											review.isPending && review.variables === "declined"
										}
										onClick={() => decide("declined")}
									>
										<IconX size={16} aria-hidden="true" />
										{t("versionControl.pullRequests.decline")}
									</Button>
									<Button
										variant="secondary"
										data-id="pull-request-approve"
										loading={
											review.isPending && review.variables === "approved"
										}
										onClick={() => decide("approved")}
									>
										<IconCheck size={16} aria-hidden="true" />
										{t("versionControl.pullRequests.approve")}
									</Button>
								</>
							) : null}
							{pr.canMerge && mergeable ? (
								<Button
									data-id="pull-request-merge"
									disabled={mergeable.preview.changes.length === 0}
									onClick={() => setStep("merge")}
								>
									<IconArrowMerge size={16} aria-hidden="true" />
									{t("versionControl.pullRequests.merge")}
								</Button>
							) : null}
						</ModalFooter>
					) : undefined
				}
			>
				<div data-id="modal-pull-request-detail" className="grid gap-4">
					{query.isPending ? (
						<SkeletonRegion label={t("versionControl.pullRequests.loading")}>
							<Skeleton className="h-32" />
						</SkeletonRegion>
					) : query.isError ? (
						<Alert tone="danger">{errorText(query.error)}</Alert>
					) : (
						<>
							<PullRequestSummary pullRequest={query.data} />
							<PullRequestThreads
								pullRequest={query.data}
								workspaceId={props.workspaceId}
								focusedCommentId={props.focusedCommentId}
							/>
						</>
					)}
					{review.isError ? (
						<Alert tone="danger">{errorText(review.error)}</Alert>
					) : null}
					{step === "edit" && pr ? (
						<PullRequestForm
							forkId={pr.forkId}
							sourceName={pr.sourceName ?? ""}
							pullRequest={pr}
							onClose={() => setStep(null)}
						/>
					) : null}
					{step === "pull" && pr?.sourceName ? (
						<SyncDialog
							fork={{ kind: "collection", id: pr.forkId }}
							direction="pull"
							source={{ id: pr.sourceId, name: pr.sourceName }}
							canEditFork
							onClose={() => setStep(null)}
						/>
					) : null}
					{step === "merge" && mergeable ? (
						<PullRequestMergeDialog
							pullRequest={mergeable}
							canEditFork={props.canEditFork}
							onClose={() => setStep(null)}
							onMerged={() => setStep(null)}
						/>
					) : null}
				</div>
			</Modal>
		</>
	);
}
