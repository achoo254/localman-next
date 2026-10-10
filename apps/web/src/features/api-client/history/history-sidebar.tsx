import { type ReactNode, memo, useId, useMemo, useState } from "react";
import { Alert } from "../../../components/ui/alert";
import { Button } from "../../../components/ui/button";
import { PanelProgress } from "../../../components/ui/panel-progress";
import { useToast } from "../../../components/ui/toast";
import { useI18n } from "../../../i18n/i18n-context";
import { errorMessage } from "../../../lib/api-client";
import { useDelayedFlag } from "../../../lib/use-delayed-flag";
import { type HistoryDetail, fetchHistoryEntry } from "./history-api";
import { HistoryClearModal } from "./history-clear-modal";
import { HistoryFilters, type HistoryMethodFilter } from "./history-filters";
import { filterHistory, groupHistoryByDay } from "./history-groups";
import { HistoryItem } from "./history-item";
import { HistorySkeleton } from "./history-skeleton";
import { useDeleteHistoryEntry, useHistoryList } from "./use-history";

export interface HistorySidebarProps {
	/** Opens the entry's request (as written) in a new tab. */
	onOpen: (entry: HistoryDetail) => void;
	/** Icon buttons in the panel head, before "Clear all" (import, export). */
	tools?: ReactNode;
}

/** Server-side history of the signed-in user, grouped by day. */
export const HistorySidebar = memo(function HistorySidebar({
	onOpen,
	tools,
}: HistorySidebarProps) {
	const { t, formatDate } = useI18n();
	const toast = useToast();
	const titleId = useId();
	const list = useHistoryList();
	const remove = useDeleteHistoryEntry();
	const [query, setQuery] = useState("");
	const [method, setMethod] = useState<HistoryMethodFilter>("ALL");
	const [openingId, setOpeningId] = useState<string | null>(null);
	const [clearOpen, setClearOpen] = useState(false);
	const skeleton = useDelayedFlag(list.isPending);
	// A refetch (after a send) with the list on screen; not "Load older".
	const refreshing =
		list.isFetching && !list.isPending && !list.isFetchingNextPage;

	const groups = useMemo(
		() =>
			groupHistoryByDay(
				filterHistory(list.entries, { query, method }),
				new Date(),
			),
		[list.entries, query, method],
	);

	const open = async (id: string): Promise<void> => {
		setOpeningId(id);
		try {
			onOpen(await fetchHistoryEntry(id));
		} catch {
			toast.show({
				tone: "error",
				title: t("apiClientTools.history.openFailed"),
			});
		} finally {
			setOpeningId(null);
		}
	};
	const removeEntry = (id: string): void => {
		remove.mutate(id, {
			onSuccess: () =>
				toast.show({
					tone: "success",
					title: t("apiClientTools.history.deleted"),
				}),
			onError: (error) =>
				toast.show({ tone: "error", title: errorMessage(error) }),
		});
	};
	const dayLabel = (kind: string, firstAt: string): string =>
		kind === "today"
			? t("apiClientTools.history.today")
			: kind === "yesterday"
				? t("apiClientTools.history.yesterday")
				: formatDate(firstAt);

	return (
		<section
			data-id="sidebar-history"
			aria-labelledby={titleId}
			className="flex min-h-0 flex-col"
		>
			<header className="flex items-center gap-1 border-border-subtle border-b py-2 pr-2 pl-3">
				<h2
					id={titleId}
					className="m-0 min-w-0 flex-1 truncate font-bold font-mono text-sm"
				>
					{t("apiClientTools.history.title")}
				</h2>
				{tools}
				<Button
					size="sm"
					variant="ghost"
					data-id="sidebar-history-clear"
					disabled={list.entries.length === 0}
					onClick={() => setClearOpen(true)}
				>
					{t("apiClientTools.history.clear")}
				</Button>
			</header>
			<HistoryFilters
				query={query}
				method={method}
				onQueryChange={setQuery}
				onMethodChange={setMethod}
			/>
			<PanelProgress
				active={refreshing}
				aria-busy={refreshing || undefined}
				data-id="sidebar-history-list"
				className="min-h-0 flex-1 overflow-y-auto"
			>
				{skeleton ? <HistorySkeleton /> : null}
				{list.isError && !skeleton ? (
					<Alert tone="danger" className="mx-3">
						{t("apiClientTools.history.loadFailed")}{" "}
						<button
							type="button"
							className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-primary underline"
							onClick={() => void list.refetch()}
						>
							{t("common.cta.retry")}
						</button>
					</Alert>
				) : null}
				{list.isSuccess && !skeleton && groups.length === 0 ? (
					<p className="m-0 px-3 py-2 text-muted text-sm">
						{list.entries.length === 0
							? t("apiClientTools.history.empty")
							: t("apiClientTools.history.noMatch")}
					</p>
				) : null}
				{(skeleton ? [] : groups).map((group) => (
					<section
						key={group.day}
						aria-label={dayLabel(group.kind, group.firstAt)}
					>
						<h3 className="m-0 px-3 pt-3 pb-1 font-mono font-semibold text-muted text-xs uppercase tracking-wide">
							{dayLabel(group.kind, group.firstAt)}
						</h3>
						<ul className="m-0 list-none p-0">
							{group.entries.map((entry) => (
								<HistoryItem
									key={entry.id}
									entry={entry}
									opening={openingId === entry.id}
									deleting={remove.isPending && remove.variables === entry.id}
									onOpen={() => void open(entry.id)}
									onDelete={() => removeEntry(entry.id)}
								/>
							))}
						</ul>
					</section>
				))}
				{list.hasNextPage && !skeleton ? (
					<div className="px-3 py-2">
						<Button
							size="sm"
							block
							data-id="sidebar-history-more"
							loading={list.isFetchingNextPage}
							onClick={() => void list.fetchNextPage()}
						>
							{t("apiClientTools.history.loadMore")}
						</Button>
					</div>
				) : null}
				<p className="m-0 px-3 py-3 text-muted text-xs">
					{t("apiClientTools.history.note")}
				</p>
			</PanelProgress>
			<HistoryClearModal open={clearOpen} onOpenChange={setClearOpen} />
		</section>
	);
});
