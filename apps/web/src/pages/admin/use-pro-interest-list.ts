import { useEffect, useRef, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { errorMessage } from "../../lib/api-client";
import { downloadText } from "../../platform/download";
import {
	EMPTY_FILTER,
	PAGE_SIZE,
	type ProInterestFilter,
	type ProInterestItem,
	type ProInterestPage,
	exportCsv,
	fetchInterests,
	isForbidden,
	setContacted,
} from "./pro-interest-admin-api";
import { maskEmail } from "./pro-interest-labels";

/** Wait for typing to pause before searching. */
const SEARCH_DELAY_MS = 300;

export type ProInterestListState =
	| { status: "loading" }
	| { status: "ready"; page: ProInterestPage }
	| { status: "error"; error: unknown };

/**
 * Sign-ups of the admin table: the page for the filter (kept on screen
 * while the next one loads, `fetching`), the "contacted" toggle shown at
 * once and put back with a toast if refused, and the CSV export.
 */
export function useProInterestList(onForbidden: () => void) {
	const t = useT();
	const toast = useToast();
	const [filter, setFilter] = useState<ProInterestFilter>(EMPTY_FILTER);
	const [page, setPage] = useState(1);
	const [state, setState] = useState<ProInterestListState>({
		status: "loading",
	});
	const [fetching, setFetching] = useState(true);
	const [reload, setReload] = useState(0);
	const [exporting, setExporting] = useState(false);
	// Parent callbacks change identity on every render; keep the fetch effect
	// keyed on the query only.
	const forbidden = useRef(onForbidden);
	forbidden.current = onForbidden;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `reload` is the retry/refresh trigger, read by nothing else.
	useEffect(() => {
		let active = true;
		setFetching(true);
		const timer = window.setTimeout(
			() => {
				fetchInterests(filter, page)
					.then(
						(value) => active && setState({ status: "ready", page: value }),
						(error: unknown) => {
							if (!active) return;
							if (isForbidden(error)) forbidden.current();
							setState({ status: "error", error });
						},
					)
					.finally(() => active && setFetching(false));
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
		const contacted = item.contactedAt === null;
		replaceItem({
			...item,
			contactedAt: contacted ? new Date().toISOString() : null,
		});
		try {
			const updated = await setContacted(item.id, contacted);
			replaceItem(updated);
			const email = maskEmail(item.email);
			const key = updated.contactedAt ? "markedContacted" : "unmarked";
			toast.show({ title: t(`admin.pro.${key}`, { email }) });
		} catch (error) {
			replaceItem(item);
			toast.show({ tone: "error", title: errorMessage(error) });
		}
	}

	async function exportFile() {
		setExporting(true);
		try {
			const { filename, csv } = await exportCsv(filter);
			downloadText(filename, csv);
			toast.show({ title: t("admin.pro.exported", { file: filename }) });
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		} finally {
			setExporting(false);
		}
	}

	const total = state.status === "ready" ? state.page.total : 0;
	return {
		filter,
		changeFilter,
		page,
		setPage,
		pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		total,
		state,
		fetching,
		refresh: () => setReload((n) => n + 1),
		exporting,
		exportFile,
		toggleContacted,
	};
}
