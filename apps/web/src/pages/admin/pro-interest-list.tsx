import { useEffect, useRef, useState } from "react";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { cardClassName } from "../../components/ui/card";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";
import { downloadText } from "../../platform/download";
import { Pagination } from "./pagination";
import {
	EMPTY_FILTER,
	PAGE_SIZE,
	type ProInterestFilter,
	type ProInterestItem,
	type ProInterestPage,
	deleteInterest,
	exportCsv,
	fetchInterests,
	isForbidden,
	setContacted,
} from "./pro-interest-admin-api";
import { ProInterestFilters } from "./pro-interest-filters";
import { maskEmail } from "./pro-interest-labels";
import { ProInterestTable } from "./pro-interest-table";

/** Wait for typing to pause before searching. */
const SEARCH_DELAY_MS = 300;

type ListState =
	| { status: "loading" }
	| { status: "ready"; page: ProInterestPage }
	| { status: "error"; error: unknown };

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
	const toast = useToast();
	const [filter, setFilter] = useState<ProInterestFilter>(EMPTY_FILTER);
	const [page, setPage] = useState(1);
	const [state, setState] = useState<ListState>({ status: "loading" });
	const [reload, setReload] = useState(0);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);
	const [deleting, setDeleting] = useState<ProInterestItem | null>(null);
	// Parent callbacks change identity on every render; keep the fetch effect
	// keyed on the query only.
	const forbidden = useRef(onForbidden);
	forbidden.current = onForbidden;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `reload` is the retry/refresh trigger, read by nothing else.
	useEffect(() => {
		let active = true;
		const timer = window.setTimeout(
			() => {
				fetchInterests(filter, page).then(
					(value) => active && setState({ status: "ready", page: value }),
					(error: unknown) => {
						if (!active) return;
						if (isForbidden(error)) forbidden.current();
						setState({ status: "error", error });
					},
				);
			},
			filter.q ? SEARCH_DELAY_MS : 0,
		);
		return () => {
			active = false;
			window.clearTimeout(timer);
		};
	}, [filter, page, reload]);

	function changeFilter(patch: Partial<ProInterestFilter>) {
		setFilter((current) => ({ ...current, ...patch }));
		setPage(1);
	}

	function replaceItem(item: ProInterestItem) {
		setState((current) =>
			current.status === "ready"
				? {
						status: "ready",
						page: {
							...current.page,
							items: current.page.items.map((row) =>
								row.id === item.id ? item : row,
							),
						},
					}
				: current,
		);
	}

	async function toggleContacted(item: ProInterestItem) {
		setPendingId(item.id);
		try {
			const updated = await setContacted(item.id, item.contactedAt === null);
			replaceItem(updated);
			toast.show({
				title: updated.contactedAt
					? `Đã đánh dấu đã liên hệ ${maskEmail(item.email)}.`
					: `Đã bỏ đánh dấu ${maskEmail(item.email)}.`,
			});
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		} finally {
			setPendingId(null);
		}
	}

	async function exportFile() {
		setExporting(true);
		try {
			const { filename, csv } = await exportCsv(filter);
			downloadText(filename, csv);
			toast.show({ title: `Đã xuất ${filename}.` });
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		} finally {
			setExporting(false);
		}
	}

	const total = state.status === "ready" ? state.page.total : 0;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

	return (
		<section
			data-id="admin-pro-list"
			className={cn(cardClassName, "overflow-hidden")}
		>
			<ProInterestFilters
				filter={filter}
				onChange={changeFilter}
				countLabel={`${formatNumber(total)} người`}
				exporting={exporting}
				onExport={() => void exportFile()}
			/>
			{state.status === "loading" ? (
				<output className="block px-5 py-6 font-mono text-muted text-sm">
					Đang tải danh sách…
				</output>
			) : null}
			{state.status === "error" ? (
				<div className="grid justify-items-start gap-3 px-5 py-6">
					<Alert tone="danger">{errorMessage(state.error)}</Alert>
					<Button onClick={() => setReload((n) => n + 1)}>Thử lại</Button>
				</div>
			) : null}
			{state.status === "ready" && state.page.items.length === 0 ? (
				<p
					data-id="admin-pro-empty"
					className="m-0 px-5 py-7 text-center text-muted"
				>
					Không có đăng ký nào khớp bộ lọc.
				</p>
			) : null}
			{state.status === "ready" && state.page.items.length > 0 ? (
				<ProInterestTable
					items={state.page.items}
					pendingId={pendingId}
					onToggleContacted={(item) => void toggleContacted(item)}
					onDelete={setDeleting}
				/>
			) : null}
			<Pagination page={page} pages={pages} onPage={setPage} />
			{deleting ? (
				<ConfirmModal
					open
					onOpenChange={(open) => !open && setDeleting(null)}
					title="Xoá theo yêu cầu"
					data-id="modal-pro-interest-delete"
					question={`Xoá đăng ký của ${maskEmail(deleting.email)}?`}
					confirmLabel="Xoá vĩnh viễn"
					onConfirm={async () => {
						await deleteInterest(deleting.id, { preview: true });
						await deleteInterest(deleting.id);
						toast.show({ title: "Đã xoá đăng ký theo yêu cầu." });
						setReload((n) => n + 1);
						onChanged();
					}}
				>
					<span>
						Email, tên, nhu cầu và ghi chú bị xoá hẳn theo yêu cầu của người
						đăng ký. Không hoàn tác được.
					</span>
				</ConfirmModal>
			) : null}
		</section>
	);
}
