import type { ChangelogChange } from "@localman/shared/api-client";
import {
	IconEye,
	IconEyeOff,
	IconHistory,
	IconListDetails,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { useToast } from "../../components/ui/toast";
import { useI18n } from "../../i18n/i18n-context";
import { AffectedNodes } from "./affected-nodes";
import { collectionErrorMessage } from "./collection-errors";
import { describeChange } from "./describe-change";
import { DiffView } from "./diff-view";
import { useChangeDiff, useSetChangeHidden } from "./use-changelog";

export interface ChangelogChangeItemProps {
	collectionId: string;
	change: ChangelogChange;
	canEdit: boolean;
	onRestore: (change: ChangelogChange) => void;
}

/** One change: what it did, its diff on demand, hide/show and restore. */
export function ChangelogChangeItem({
	collectionId,
	change,
	canEdit,
	onRestore,
}: ChangelogChangeItemProps) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const [open, setOpen] = useState(false);
	const diff = useChangeDiff(collectionId, change.id, open && !change.hidden);
	const visibility = useSetChangeHidden(collectionId);
	const text = describeChange(change, t);
	const toggleHidden = () =>
		visibility.mutate(
			{ id: change.id, hidden: !change.hidden },
			{
				onError: (error) =>
					toast.show({
						tone: "error",
						title: collectionErrorMessage(error, t),
					}),
			},
		);
	let body = null;
	if (open && change.hidden) {
		body = (
			<p className="m-0 text-muted text-xs">
				{t("collections.changelog.hidden")}
			</p>
		);
	} else if (open && diff.isError) {
		body = (
			<p className="m-0 text-error-text text-xs">
				{t("collections.changelog.diffFailed")}
			</p>
		);
	} else if (open && diff.data && !diff.data.available) {
		body = (
			<p className="m-0 text-muted text-xs">
				{t("collections.changelog.unavailable")}
			</p>
		);
	} else if (open && diff.data) {
		body = (
			<>
				<DiffView
					before={diff.data.before}
					after={diff.data.after}
					label={t("collections.changelog.diffLabel", {
						name: change.entityName,
					})}
				/>
				<AffectedNodes nodes={diff.data.affected ?? []} />
			</>
		);
	} else if (open) {
		body = <p className="m-0 text-muted text-xs">{t("common.loading")}</p>;
	}
	return (
		<li
			data-id="changelog-change"
			className="grid gap-1.5 border-border-subtle border-t py-2 first:border-t-0"
		>
			<p className="m-0 text-sm">{text}</p>
			<p className="m-0 text-muted text-xs">{formatDate(change.at)}</p>
			<div className="flex flex-wrap gap-1">
				<Button
					size="sm"
					variant="ghost"
					aria-expanded={open}
					data-id="changelog-view-diff"
					onClick={() => setOpen(!open)}
				>
					<IconListDetails size={14} aria-hidden="true" />
					{t(
						open
							? "collections.changelog.closeDiff"
							: "collections.changelog.viewDiff",
					)}
				</Button>
				{canEdit ? (
					<Button
						size="sm"
						variant="ghost"
						loading={visibility.isPending}
						data-id={
							change.hidden ? "changelog-show-diff" : "changelog-hide-diff"
						}
						title={
							change.hidden ? undefined : t("collections.changelog.hideNote")
						}
						onClick={toggleHidden}
					>
						{change.hidden ? (
							<IconEye size={14} aria-hidden="true" />
						) : (
							<IconEyeOff size={14} aria-hidden="true" />
						)}
						{t(
							change.hidden
								? "collections.changelog.show"
								: "collections.changelog.hide",
						)}
					</Button>
				) : null}
				{canEdit && change.restorable ? (
					<Button
						size="sm"
						variant="ghost"
						data-id="changelog-restore"
						onClick={() => onRestore(change)}
					>
						<IconHistory size={14} aria-hidden="true" />
						{t("collections.changelog.restore")}
					</Button>
				) : null}
			</div>
			{body}
		</li>
	);
}
