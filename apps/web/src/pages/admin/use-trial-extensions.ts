import { useEffect, useState } from "react";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { ApiError } from "../../lib/api-client";
import { isForbidden } from "./pro-interest-admin-api";
import {
	type ExtensionFilter,
	type TrialExtensionItem,
	type TrialExtensionPage,
	adminTrialErrorMessage,
	decideTrialExtension,
	fetchTrialExtensions,
	isStaleRequestError,
	requesterLabel,
} from "./trial-extensions-api";

export type ExtensionListState =
	| { status: "loading" }
	| { status: "ready"; page: TrialExtensionPage }
	| { status: "error"; error: unknown };

/**
 * Trial extension requests, a cursor page at a time. `cursors` holds the
 * cursor of every page opened so far (null for the first), so "Previous"
 * goes back without the API knowing page numbers. A change of filter or
 * page keeps the shown requests while the next ones load (`fetching`).
 */
export function useTrialExtensions() {
	const t = useT();
	const toast = useToast();
	const [filter, setFilter] = useState<ExtensionFilter>("pending");
	const [cursors, setCursors] = useState<Array<string | null>>([null]);
	const [state, setState] = useState<ExtensionListState>({
		status: "loading",
	});
	const [reload, setReload] = useState(0);
	const [forbidden, setForbidden] = useState(false);
	const [fetching, setFetching] = useState(true);
	const refresh = () => setReload((n) => n + 1);
	const cursor = cursors.at(-1) ?? null;

	// biome-ignore lint/correctness/useExhaustiveDependencies: `reload` is the retry/refresh trigger, read by nothing else.
	useEffect(() => {
		let active = true;
		setFetching(true);
		fetchTrialExtensions(filter, cursor)
			.then(
				(page) => {
					if (!active) return;
					// The last requests of a later page were decided: step back.
					if (page.items.length === 0 && cursors.length > 1) {
						setCursors((current) => current.slice(0, -1));
						return;
					}
					setState({ status: "ready", page });
				},
				(error: unknown) => {
					if (!active) return;
					if (isForbidden(error)) setForbidden(true);
					setState({ status: "error", error });
				},
			)
			.finally(() => active && setFetching(false));
		return () => {
			active = false;
		};
	}, [filter, cursor, reload]);

	function changeFilter(next: ExtensionFilter) {
		setFilter(next);
		setCursors([null]);
	}

	const page = cursors.length;
	const nextCursor = state.status === "ready" ? state.page.nextCursor : null;
	function setPage(target: number) {
		if (target > page && nextCursor) {
			setCursors((current) => [...current, nextCursor]);
		} else if (target < page) {
			setCursors((current) => current.slice(0, Math.max(1, target)));
		}
	}

	/** Approve or decline; errors reach the confirmation dialog. */
	async function decide(
		item: TrialExtensionItem,
		decision: "approve" | "decline",
	): Promise<void> {
		try {
			await decideTrialExtension(item.id, decision);
		} catch (error) {
			// Decided elsewhere or gone: show the list as it is now.
			if (isStaleRequestError(error)) refresh();
			throw error instanceof ApiError
				? new ApiError(
						error.status,
						error.code,
						adminTrialErrorMessage(error, t, "request"),
					)
				: error;
		}
		const user = requesterLabel(item);
		toast.show({
			title:
				decision === "approve"
					? t("admin.trial.approved", { user })
					: t("admin.trial.declined", { user }),
		});
		refresh();
	}

	return {
		filter,
		changeFilter,
		page,
		pages: nextCursor ? page + 1 : page,
		setPage,
		state,
		forbidden,
		fetching,
		refresh,
		decide,
	};
}
