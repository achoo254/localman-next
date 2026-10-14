import { IconTrash } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Badge } from "../../components/ui/badge";
import { cardClassName } from "../../components/ui/card";
import { CodeBlock } from "../../components/ui/code-block";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { IconButton } from "../../components/ui/icon-button";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useI18n, useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { DANGER_GHOST } from "../collaborators/collaborators-footer";
import type { ShareableEnvironment } from "../sharing/share-people-form";
import {
	publicSharingErrorMessage,
	withTranslatedError,
} from "./public-sharing-errors";
import { type RunButton, deleteRunButton, embedCodes } from "./run-buttons-api";
import { runButtonsKey, useRunButtons } from "./use-public-sharing";

function RunButtonItem({
	button,
	environments,
	onDelete,
}: {
	button: RunButton;
	environments: readonly ShareableEnvironment[];
	onDelete: () => void;
}) {
	const t = useT();
	const { formatDate } = useI18n();
	const codes = embedCodes(button);
	const created = formatDate(button.createdAt);
	const env = button.environmentId
		? environments.find((e) => e.id === button.environmentId)
		: undefined;
	return (
		<li
			data-id="share-run-item"
			className={cn(cardClassName, "grid min-w-0 gap-3 p-4 shadow-none")}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="grid min-w-0 gap-1">
					<span className="flex flex-wrap items-center gap-2 text-sm">
						<Badge
							tone={button.visibility === "public" ? "warning" : "neutral"}
						>
							{t(`publicSharing.share.run.visibilities.${button.visibility}`)}
						</Badge>
						<span className="text-muted">
							{t("publicSharing.share.run.created", { date: created })}
						</span>
					</span>
					{button.environmentId ? (
						<span className="break-words text-muted text-[0.8125rem]">
							{env
								? t("publicSharing.share.run.environmentLabel", {
										name: env.name,
									})
								: t("publicSharing.share.run.environmentGone")}
						</span>
					) : null}
				</div>
				<IconButton
					label={t("publicSharing.share.run.delete", { date: created })}
					icon={<IconTrash size={16} aria-hidden="true" />}
					className={DANGER_GHOST}
					data-id="share-run-delete"
					onClick={onDelete}
				/>
			</div>
			<CodeBlock
				caption={t("publicSharing.share.run.markdown")}
				code={codes.markdown}
				data-id="share-run-markdown"
			/>
			<CodeBlock
				caption={t("publicSharing.share.run.html")}
				code={codes.html}
				data-id="share-run-html"
			/>
		</li>
	);
}

/** Run buttons of the collection with their embed codes; delete confirms. */
export function RunButtonList({
	collectionId,
	environments,
}: {
	collectionId: string;
	environments: readonly ShareableEnvironment[];
}) {
	const t = useT();
	const toast = useToast();
	const client = useQueryClient();
	const titleId = useId();
	const query = useRunButtons(collectionId);
	const [deleting, setDeleting] = useState<RunButton | null>(null);

	async function remove(button: RunButton) {
		await withTranslatedError(t, () =>
			deleteRunButton(collectionId, button.id),
		);
		client.setQueryData<RunButton[]>(runButtonsKey(collectionId), (list) =>
			list?.filter((b) => b.id !== button.id),
		);
		toast.show({ title: t("publicSharing.share.run.deleted") });
	}

	let body: ReactNode;
	if (query.isPending) {
		body = (
			<SkeletonRegion className="grid gap-2">
				<Skeleton className="h-32 w-full" />
			</SkeletonRegion>
		);
	} else if (query.error) {
		body = (
			<Alert tone="danger" title={t("publicSharing.share.run.loadFailed")}>
				{publicSharingErrorMessage(query.error, t)}
			</Alert>
		);
	} else if (query.data.length === 0) {
		body = (
			<p className="m-0 text-muted text-sm" data-id="share-run-empty">
				{t("publicSharing.share.run.empty")}
			</p>
		);
	} else {
		body = (
			<ul className="m-0 grid list-none gap-3 p-0" data-id="share-run-list">
				{query.data.map((button) => (
					<RunButtonItem
						key={button.id}
						button={button}
						environments={environments}
						onDelete={() => setDeleting(button)}
					/>
				))}
			</ul>
		);
	}

	return (
		<section aria-labelledby={titleId} className="grid gap-2">
			<h4
				id={titleId}
				className="m-0 font-mono font-semibold text-[0.8125rem] text-muted"
			>
				{t("publicSharing.share.run.listTitle")}
			</h4>
			{body}
			<ConfirmModal
				open={deleting !== null}
				onOpenChange={(open) => {
					if (!open) setDeleting(null);
				}}
				title={t("publicSharing.share.run.deleteTitle")}
				question={t("publicSharing.share.run.deleteQuestion")}
				confirmLabel={t("publicSharing.share.run.deleteConfirm")}
				onConfirm={async () => {
					if (deleting) await remove(deleting);
				}}
				data-id="share-run-delete-modal"
			>
				<span>{t("publicSharing.share.run.deleteText")}</span>
			</ConfirmModal>
		</section>
	);
}
