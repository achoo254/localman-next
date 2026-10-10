import { useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { PanelProgress } from "../../components/ui/panel-progress";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { useDelayedFlag } from "../../lib/use-delayed-flag";
import { AdminListSkeleton } from "./admin-skeletons";
import { Pagination } from "./pagination";
import { type ProInterestItem, deleteInterest } from "./pro-interest-admin-api";
import { ProInterestFilters } from "./pro-interest-filters";
import { maskEmail } from "./pro-interest-labels";
import { ProInterestTable } from "./pro-interest-table";
import { useProInterestList } from "./use-pro-interest-list";

export interface ProInterestListProps {
	/** A row was deleted: totals and charts need a refresh. */
	onChanged: () => void;
	onForbidden: () => void;
}

/** Filterable, paged sign-up table with export, follow-up and delete. */
export function ProInterestList({
	onChanged,
	onForbidden,
}: ProInterestListProps) {
	const t = useT();
	const toast = useToast();
	const list = useProInterestList(onForbidden);
	const { state } = list;
	const [deleting, setDeleting] = useState<ProInterestItem | null>(null);
	// First load only; later pages and filters keep the rows under a bar.
	const skeleton = useDelayedFlag(state.status === "loading");
	const refreshing = list.fetching && state.status === "ready";

	return (
		<section
			data-id="admin-pro-list"
			className={cn(cardClassName, "overflow-hidden")}
		>
			<ProInterestFilters
				filter={list.filter}
				onChange={list.changeFilter}
				countLabel={t("admin.pro.count", { count: list.total })}
				exporting={list.exporting}
				onExport={() => void list.exportFile()}
			/>
			{skeleton ? (
				<AdminListSkeleton
					data-id="admin-pro-loading"
					label={t("admin.pro.loading")}
				/>
			) : null}
			{state.status === "error" && !skeleton ? (
				<div className="grid justify-items-start gap-3 px-5 py-6">
					<Alert tone="danger">{errorMessage(state.error)}</Alert>
					<Button onClick={list.refresh}>{t("common.cta.retry")}</Button>
				</div>
			) : null}
			<PanelProgress
				active={refreshing}
				dim
				aria-busy={refreshing || undefined}
			>
				{state.status === "ready" &&
				!skeleton &&
				state.page.items.length === 0 ? (
					<p
						data-id="admin-pro-empty"
						className="m-0 px-5 py-7 text-center text-muted"
					>
						{t("admin.pro.empty")}
					</p>
				) : null}
				{state.status === "ready" &&
				!skeleton &&
				state.page.items.length > 0 ? (
					<ProInterestTable
						items={state.page.items}
						onToggleContacted={(item) => void list.toggleContacted(item)}
						onDelete={setDeleting}
					/>
				) : null}
			</PanelProgress>
			<Pagination page={list.page} pages={list.pages} onPage={list.setPage} />
			{deleting ? (
				<ConfirmModal
					open
					onOpenChange={(open) => !open && setDeleting(null)}
					title={t("admin.pro.deleteTitle")}
					data-id="modal-pro-interest-delete"
					question={t("admin.pro.deleteQuestion", {
						email: maskEmail(deleting.email),
					})}
					confirmLabel={t("admin.deletePermanently")}
					onConfirm={async () => {
						await deleteInterest(deleting.id, { preview: true });
						await deleteInterest(deleting.id);
						toast.show({ title: t("admin.pro.deleted") });
						list.refresh();
						onChanged();
					}}
				>
					<span>{t("admin.pro.deleteBody")}</span>
				</ConfirmModal>
			) : null}
		</section>
	);
}
