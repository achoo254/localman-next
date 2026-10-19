import type { ChangelogChange } from "@localman/shared/api-client";
import { useId, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { Skeleton, SkeletonRegion } from "../../components/ui/skeleton";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { initialOf } from "../../lib/initial";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { previewRestore } from "./bulk-api";
import { ChangelogChangeItem } from "./changelog-change-item";
import { collectionErrorMessage, translatedError } from "./collection-errors";
import { IrreversibleNote, useIrreversible } from "./irreversible-note";
import { useDiscardPageEdits } from "./page-save-context";
import { useChangelog, useRestoreChange } from "./use-changelog";
import { useRefreshBoundTabs } from "./use-refresh-bound-tabs";

export interface ChangelogPanelProps {
	collectionId: string;
	canEdit: boolean;
}

/** Sessions of changes, newest first, with diffs, hiding and restore. */
export function ChangelogPanel({ collectionId, canEdit }: ChangelogPanelProps) {
	const viewerNoteId = useId();
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const log = useChangelog(collectionId);
	const refreshTabs = useRefreshBoundTabs();
	const restore = useRestoreChange(collectionId, refreshTabs);
	const discardPageEdits = useDiscardPageEdits();
	const [restoring, setRestoring] = useState<ChangelogChange | null>(null);
	const skeleton = useDelayedFlag(log.isPending);
	const sessions = log.data?.pages.flatMap((page) => page.sessions) ?? [];
	const preview = useIrreversible(
		["restore", collectionId, restoring?.id ?? ""],
		() => previewRestore(collectionId, restoring?.id ?? ""),
		restoring !== null,
	);

	const confirmRestore = async (): Promise<void> => {
		if (!restoring) return;
		try {
			await restore.mutateAsync(restoring.id);
		} catch (error) {
			if (error instanceof ApiError && error.code === "REVISION_UNAVAILABLE") {
				throw new ApiError(
					error.status,
					error.code,
					t("collections.changelog.unavailableRestore"),
				);
			}
			throw translatedError(error, t);
		}
		// Unsent edits of open pages would overwrite what was restored.
		const discarded = discardPageEdits(collectionId);
		toast.show({
			tone: "success",
			title: t("collections.changelog.restored"),
			description:
				discarded > 0 ? t("collections.changelog.editsDiscarded") : undefined,
		});
	};

	return (
		<div className="grid content-start gap-3">
			<p className="m-0 text-muted text-xs">
				{t("collections.changelog.intro")}
			</p>
			{canEdit ? null : (
				<p
					id={viewerNoteId}
					data-id="changelog-viewer-note"
					className="m-0 text-muted text-xs"
				>
					{t("collections.changelog.restoreNeedsEditor")}
				</p>
			)}
			{skeleton ? (
				<SkeletonRegion
					label={t("collections.changelog.loading")}
					className="grid gap-3"
				>
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</SkeletonRegion>
			) : null}
			{log.isError ? (
				<Alert tone="danger">
					{t("collections.changelog.loadFailed")}{" "}
					{collectionErrorMessage(log.error, t)}
				</Alert>
			) : null}
			{log.isSuccess && sessions.length === 0 ? (
				<p className="m-0 text-muted text-sm">
					{t("collections.changelog.empty")}
				</p>
			) : null}
			<ol className="m-0 grid list-none gap-3 p-0">
				{sessions.map((session) => (
					<li
						key={`${session.authorId}-${session.to}`}
						data-id="changelog-session"
						className="grid gap-1 rounded-md border border-border-subtle bg-surface p-3"
					>
						<div className="flex items-center gap-2">
							<span
								aria-hidden="true"
								className="grid size-7 flex-none place-items-center rounded-full bg-primary/10 font-bold text-primary text-xs"
							>
								{initialOf(session.authorName)}
							</span>
							<div className="grid min-w-0 flex-1">
								<span className="truncate font-semibold text-sm">
									{session.authorName ??
										t("collections.changelog.removedAccount")}
									{session.changes[0]?.viaMcp ? (
										<span
											data-id="changelog-session-via-mcp"
											className="ml-2 font-normal text-muted text-xs"
										>
											{t("collections.changelog.viaMcp")}
										</span>
									) : null}
								</span>
								<span className="text-muted text-xs">
									{formatDate(session.to)} ·{" "}
									{t("collections.changelog.changes", {
										count: session.changes.length,
									})}
								</span>
							</div>
						</div>
						<ul className="m-0 list-none p-0">
							{session.changes.map((change) => (
								<ChangelogChangeItem
									restoreNoteId={canEdit ? undefined : viewerNoteId}
									key={change.id}
									collectionId={collectionId}
									change={change}
									canEdit={canEdit}
									onRestore={setRestoring}
								/>
							))}
						</ul>
					</li>
				))}
			</ol>
			{log.hasNextPage ? (
				<Button
					size="sm"
					data-id="changelog-load-older"
					loading={log.isFetchingNextPage}
					onClick={() => void log.fetchNextPage()}
				>
					{t("collections.changelog.loadOlder")}
				</Button>
			) : null}
			<ConfirmModal
				open={restoring !== null}
				onOpenChange={(open) => {
					if (!open) setRestoring(null);
				}}
				title={t("collections.changelog.restoreTitle")}
				question={t("collections.changelog.restoreQuestion")}
				confirmLabel={t("collections.changelog.restore")}
				onConfirm={confirmRestore}
				confirmDisabled={preview.pending}
				data-id="modal-restore-change"
			>
				<p className="m-0">{t("collections.changelog.restoreBody")}</p>
				<IrreversibleNote show={preview.irreversible} />
			</ConfirmModal>
		</div>
	);
}
