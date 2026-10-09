import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { errorMessage } from "../../lib/api-client";
import {
	type ContactMessage,
	type ContactMessagePage,
	EMPTY_INBOX_FILTER,
	INBOX_PAGE_SIZE,
	type InboxFilter,
	type MessageStatus,
	deleteContactMessage,
	fetchContactMessages,
	setMessageStatus,
} from "./feedback-inbox-api";
import { STATUS_LABELS } from "./feedback-inbox-item";
import { isForbidden } from "./pro-interest-admin-api";

export type InboxListState =
	| { status: "loading" }
	| { status: "ready"; page: ContactMessagePage }
	| { status: "error"; error: unknown };

/**
 * Inbox data: the current page for the filter, follow-up status changes
 * and deletes. Every change of filter or page shows the loading state; a
 * page left empty (its last message deleted or moved out of the filter)
 * moves back to the last page that has messages.
 */
export function useFeedbackInbox() {
	const toast = useToast();
	const [filter, setFilter] = useState<InboxFilter>(EMPTY_INBOX_FILTER);
	const [page, setPage] = useState(1);
	const [state, setState] = useState<InboxListState>({ status: "loading" });
	const [reload, setReload] = useState(0);
	const [forbidden, setForbidden] = useState(false);
	const [pendingId, setPendingId] = useState<string | null>(null);
	const refresh = () => setReload((n) => n + 1);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `reload` is the retry/refresh trigger, read by nothing else.
	useEffect(() => {
		let active = true;
		setState({ status: "loading" });
		fetchContactMessages(filter, page).then(
			(value) => {
				if (!active) return;
				const last = Math.max(1, Math.ceil(value.total / INBOX_PAGE_SIZE));
				if (value.items.length === 0 && page > last) {
					setPage(last);
					return;
				}
				setState({ status: "ready", page: value });
			},
			(error: unknown) => {
				if (!active) return;
				if (isForbidden(error)) setForbidden(true);
				setState({ status: "error", error });
			},
		);
		return () => {
			active = false;
		};
	}, [filter, page, reload]);

	function changeFilter(patch: Partial<InboxFilter>) {
		setFilter((current) => ({ ...current, ...patch }));
		setPage(1);
	}

	async function changeStatus(item: ContactMessage, status: MessageStatus) {
		setPendingId(item.id);
		try {
			const updated = await setMessageStatus(item.id, status);
			toast.show({ title: `Đã chuyển sang “${STATUS_LABELS[status].label}”.` });
			// The message may no longer match a status filter: reload the page.
			if (filter.status && filter.status !== updated.status) {
				refresh();
				return;
			}
			setState((current) =>
				current.status === "ready"
					? {
							status: "ready",
							page: {
								...current.page,
								items: current.page.items.map((row) =>
									row.id === updated.id ? updated : row,
								),
							},
						}
					: current,
			);
		} catch (error) {
			toast.show({ tone: "error", title: errorMessage(error) });
		} finally {
			setPendingId(null);
		}
	}

	/** Dry run, then the delete; errors reach the confirmation dialog. */
	async function remove(item: ContactMessage): Promise<void> {
		await deleteContactMessage(item.id, { preview: true });
		await deleteContactMessage(item.id);
		toast.show({ title: "Đã xoá tin." });
		refresh();
	}

	const total = state.status === "ready" ? state.page.total : 0;
	return {
		filter,
		changeFilter,
		page,
		setPage,
		pages: Math.max(1, Math.ceil(total / INBOX_PAGE_SIZE)),
		total,
		state,
		forbidden,
		pendingId,
		refresh,
		changeStatus,
		remove,
	};
}
