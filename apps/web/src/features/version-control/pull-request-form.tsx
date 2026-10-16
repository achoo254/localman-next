import {
	PULL_REQUEST_DESCRIPTION_MAX,
	PULL_REQUEST_TITLE_MAX,
	type PullRequestView,
} from "@localman/shared/api-client";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { FormField } from "../../components/ui/form-field";
import { Input } from "../../components/ui/input";
import { Modal, ModalClose } from "../../components/ui/modal";
import { ModalFooter } from "../../components/ui/modal-footer";
import { Skeleton } from "../../components/ui/skeleton";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { useForkErrorMessage } from "./fork-errors";
import {
	useCreatePullRequest,
	usePullRequestActions,
	useReviewerCandidates,
} from "./use-pull-requests";

export interface PullRequestFormProps {
	forkId: string;
	sourceName: string;
	/** Edits this pull request; creates one when absent. */
	pullRequest?: PullRequestView;
	onClose: () => void;
}

/** Title, description and reviewers of a new pull request, or of yours. */
export function PullRequestForm({
	forkId,
	sourceName,
	pullRequest,
	onClose,
}: PullRequestFormProps) {
	const t = useT();
	const toast = useToast();
	const formId = useId();
	const errorText = useForkErrorMessage();
	const candidates = useReviewerCandidates(forkId);
	const create = useCreatePullRequest(forkId);
	const { update } = usePullRequestActions(pullRequest?.id ?? "");
	const write = pullRequest ? update : create;
	const [title, setTitle] = useState(pullRequest?.title ?? "");
	const [description, setDescription] = useState(
		pullRequest?.description ?? "",
	);
	const [reviewerIds, setReviewerIds] = useState<string[]>(
		pullRequest?.reviewers.map((review) => review.userId) ?? [],
	);
	const toggle = (userId: string, on: boolean) =>
		setReviewerIds((ids) =>
			on ? [...ids, userId] : ids.filter((id) => id !== userId),
		);
	const submit = () =>
		write.mutate(
			{ title: title.trim(), description: description.trim(), reviewerIds },
			{
				onSuccess: () => {
					toast.show({
						tone: "success",
						title: t(
							pullRequest
								? "versionControl.pullRequests.saved"
								: "versionControl.pullRequests.created",
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
			title={
				pullRequest
					? t("versionControl.pullRequests.editTitle")
					: t("versionControl.pullRequests.createTitle", { name: sourceName })
			}
			description={
				pullRequest
					? undefined
					: t("versionControl.pullRequests.createIntro", { name: sourceName })
			}
			size="lg"
			footer={
				<ModalFooter>
					<ModalClose asChild>
						<Button variant="ghost">{t("common.actions.cancel")}</Button>
					</ModalClose>
					<Button
						type="submit"
						form={formId}
						data-id="modal-pull-request-submit"
						loading={write.isPending}
						disabled={title.trim() === ""}
					>
						{pullRequest
							? t("versionControl.pullRequests.save")
							: t("versionControl.pullRequests.submit")}
					</Button>
				</ModalFooter>
			}
		>
			<form
				id={formId}
				data-id="modal-pull-request"
				className="grid gap-3"
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<FormField label={t("versionControl.pullRequests.title")}>
					<Input
						value={title}
						maxLength={PULL_REQUEST_TITLE_MAX}
						data-id="modal-pull-request-title"
						onChange={(event) => setTitle(event.target.value)}
					/>
				</FormField>
				<FormField
					label={t("versionControl.pullRequests.description")}
					hint={t("versionControl.pullRequests.descriptionHint")}
				>
					<Textarea
						value={description}
						rows={5}
						maxLength={PULL_REQUEST_DESCRIPTION_MAX}
						data-id="modal-pull-request-description"
						onChange={(event) => setDescription(event.target.value)}
					/>
				</FormField>
				<fieldset className="m-0 grid gap-2 border-0 p-0">
					<legend className="mb-1 font-semibold text-sm">
						{t("versionControl.pullRequests.reviewers")}
					</legend>
					<p className="m-0 text-muted text-xs">
						{t("versionControl.pullRequests.reviewersHint")}
					</p>
					{candidates.isPending ? (
						<Skeleton className="h-10" />
					) : candidates.isError ? (
						<Alert tone="danger">{errorText(candidates.error)}</Alert>
					) : candidates.data.length === 0 ? (
						<p className="m-0 text-muted text-sm">
							{t("versionControl.pullRequests.noReviewers")}
						</p>
					) : (
						candidates.data.map((person) => (
							<label
								key={person.userId}
								className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
							>
								<input
									type="checkbox"
									checked={reviewerIds.includes(person.userId)}
									data-id="modal-pull-request-reviewer"
									className="size-4 accent-primary-solid"
									onChange={(event) =>
										toggle(person.userId, event.target.checked)
									}
								/>
								<span>{person.name ?? person.username}</span>
								<span className="text-muted text-xs">@{person.username}</span>
							</label>
						))
					)}
				</fieldset>
				{write.isError ? (
					<Alert tone="danger">{errorText(write.error)}</Alert>
				) : null}
			</form>
		</Modal>
	);
}
