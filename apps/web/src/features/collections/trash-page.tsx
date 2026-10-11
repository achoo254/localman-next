import { IconArrowLeft, IconTrash } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router";
import { Alert } from "../../components/ui/alert";
import { Button, buttonClassName } from "../../components/ui/button";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { EmptyState } from "../../components/ui/empty-state";
import { Input } from "../../components/ui/input";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { useAppTitle } from "../../lib/use-document-title";
import { useWorkspacesEnabled } from "../workspaces/use-workspaces-enabled";
import { collectionErrorMessage, translatedError } from "./collection-errors";
import type { TrashedCollection } from "./collection-parsers";
import { RestoreModal } from "./restore-modal";
import { TrashSkeleton } from "./trash-skeleton";
import { TrashTable } from "./trash-table";
import { matches } from "./tree-search";
import { useDeleteTrashed, useTrash, useTrashDays } from "./use-trash";

type TrashDialog = { kind: "restore" | "purge"; item: TrashedCollection };

function Trash() {
	const t = useT();
	useAppTitle(t("collections.trash.pageTitle"));
	const toast = useToast();
	const days = useTrashDays();
	const trash = useTrash();
	const purge = useDeleteTrashed();
	const searchRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [dialog, setDialog] = useState<TrashDialog | null>(null);
	const [open, setOpen] = useState(false);
	const skeleton = useDelayedFlag(trash.isPending);
	const items = useMemo(
		() =>
			(trash.data ?? []).filter(
				(item) => query.trim() === "" || matches(item.name, query),
			),
		[trash.data, query],
	);
	const show = (kind: TrashDialog["kind"], item: TrashedCollection) => {
		setDialog({ kind, item });
		setOpen(true);
	};
	// The row is gone after a restore or delete: focus the search box.
	const focusAfter = (event: Event): void => {
		const id = dialog?.item.id;
		if (id && trash.data?.some((item) => item.id === id)) return;
		event.preventDefault();
		searchRef.current?.focus();
	};

	let body = null;
	if (skeleton) body = <TrashSkeleton />;
	else if (trash.isError) {
		body = (
			<div className="grid justify-items-start gap-3">
				<Alert tone="danger" title={t("collections.trash.loadFailed")}>
					{collectionErrorMessage(trash.error, t)}
				</Alert>
				<Button size="sm" onClick={() => void trash.refetch()}>
					{t("common.cta.retry")}
				</Button>
			</div>
		);
	} else if (trash.isSuccess && trash.data.length === 0) {
		body = (
			<EmptyState
				data-id="trash-empty"
				icon={<IconTrash size={32} aria-hidden="true" />}
				title={t("collections.trash.emptyTitle")}
			>
				{t("collections.trash.emptyBody")}
			</EmptyState>
		);
	} else if (trash.isSuccess && items.length === 0) {
		body = (
			<p className="m-0 text-muted text-sm">
				{t("collections.trash.noMatch", { query: query.trim() })}
			</p>
		);
	} else if (trash.isSuccess) {
		body = (
			<TrashTable
				items={items}
				now={new Date()}
				onRestore={(item) => show("restore", item)}
				onDelete={(item) => show("purge", item)}
			/>
		);
	}

	return (
		<div data-id="trash-page" className="grid gap-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="grid min-w-0 gap-1">
					<h1 className="m-0 font-bold font-mono text-2xl">
						{t("collections.trash.title")}
					</h1>
					<p data-id="trash-retention" className="m-0 text-muted text-sm">
						{t("collections.trash.retention", { count: days })}
					</p>
				</div>
				<Link
					to="/api-client"
					data-id="trash-back"
					className={cn(buttonClassName(), "no-underline")}
				>
					<IconArrowLeft size={16} aria-hidden="true" />
					{t("collections.trash.back")}
				</Link>
			</header>
			<Input
				ref={searchRef}
				type="search"
				value={query}
				aria-label={t("collections.trash.search")}
				placeholder={t("collections.trash.searchPlaceholder")}
				data-id="trash-search"
				className="max-w-sm"
				onChange={(event) => setQuery(event.target.value)}
			/>
			{body}
			{dialog?.kind === "restore" ? (
				<RestoreModal
					key={dialog.item.id}
					item={dialog.item}
					open={open}
					onOpenChange={setOpen}
					onCloseAutoFocus={focusAfter}
				/>
			) : null}
			{dialog?.kind === "purge" ? (
				<ConfirmModal
					open={open}
					onOpenChange={setOpen}
					title={t("collections.trash.purge.title")}
					question={t("collections.trash.purge.question", {
						name: dialog.item.name,
					})}
					confirmLabel={t("collections.trash.purge.confirm")}
					onCloseAutoFocus={focusAfter}
					data-id="modal-trash-purge"
					onConfirm={async () => {
						try {
							await purge.mutateAsync(dialog.item.id);
						} catch (error) {
							throw translatedError(error, t);
						}
						toast.show({
							tone: "success",
							title: t("collections.trash.toast.purged", {
								name: dialog.item.name,
							}),
						});
					}}
				>
					<p className="m-0">{t("collections.trash.purge.body")}</p>
				</ConfirmModal>
			) : null}
		</div>
	);
}

/** `/trash`: deleted collections to restore or delete for good (workspaces flag). */
export function TrashPage() {
	const workspaces = useWorkspacesEnabled();
	return workspaces ? <Trash /> : <Navigate to="/api-client" replace />;
}
