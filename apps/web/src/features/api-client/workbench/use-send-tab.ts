/**
 * Sending for the workbench: one request in flight per tab, cancellable,
 * its outcome stored as the tab's response, then recorded in history.
 */
import { useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type RefObject, useCallback, useRef } from "react";
import { useToast } from "../../../components/ui/toast";
import { activeTranslator } from "../../../i18n/active-translator";
import { useT } from "../../../i18n/i18n-context";
import { recordSend } from "./record-send";
import { failed } from "./send-steps";
import type { WorkbenchAction } from "./workbench-action";
import type { WorkbenchState } from "./workbench-reducer";
import type { SendContext } from "./workbench-tab-types";
import type {
	RequestSender,
	SendOptions,
	SettledResponse,
	WorkbenchTab,
} from "./workbench-types";

/**
 * What a tab bound to a collection request inherits when sent. When its
 * collection (or the request in it) cannot be read, the send fails with
 * `unavailable`, the reason to show: sending it as a loose request would
 * drop its auth and scripts without a word.
 */
export type SendContextOf = (
	tab: WorkbenchTab,
) => Promise<{ context: SendContext } | { unavailable: string }>;

export interface SendTab {
	send: (tabId: string, options?: SendOptions) => Promise<void>;
	cancel: (tabId: string) => void;
	/** Stops a send without a response update (the tab is closing). */
	abort: (tabId: string) => void;
}

function senderBug(): SettledResponse {
	const message = activeTranslator().t("common.errors.server");
	return {
		kind: "failed",
		failure: { code: "SEND_FAILED", message, status: null, preScript: null },
	};
}

export function useSendTab(
	latest: RefObject<WorkbenchState>,
	dispatch: Dispatch<WorkbenchAction>,
	sender: RequestSender,
	sendContext?: SendContextOf,
): SendTab {
	const t = useT();
	const toast = useToast();
	const queryClient = useQueryClient();
	const controllers = useRef(new Map<string, AbortController>());
	// Read at send time, so a new function does not change `send`.
	const contextOf = useRef(sendContext);
	contextOf.current = sendContext;

	const abort = useCallback((tabId: string) => {
		controllers.current.get(tabId)?.abort();
		controllers.current.delete(tabId);
	}, []);

	const send = useCallback(
		async (tabId: string, options?: SendOptions) => {
			const tab = latest.current.tabs.find((item) => item.id === tabId);
			if (!tab || tab.response.kind === "sending") return;
			const controller = new AbortController();
			controllers.current.set(tabId, controller);
			dispatch({
				type: "setResponse",
				id: tabId,
				response: { kind: "sending" },
			});
			let settled: SettledResponse;
			try {
				const { draft, files, routeChosen } = tab;
				const resolve = contextOf.current;
				const found = tab.source && resolve ? await resolve(tab) : null;
				settled =
					found && "unavailable" in found
						? failed({
								code: "COLLECTION_UNAVAILABLE",
								message: found.unavailable,
							})
						: await sender({
								draft,
								files,
								signal: controller.signal,
								routeChosen,
								...(options ? { options } : {}),
								...(found ? { context: found.context } : {}),
							});
			} catch {
				// Senders never reject; a bug in one must not leave the tab spinning.
				settled = senderBug();
			}
			if (controllers.current.get(tabId) !== controller) return;
			controllers.current.delete(tabId);
			dispatch({
				type: "setResponse",
				id: tabId,
				response:
					settled.kind === "done" ? { ...settled, draft: tab.draft } : settled,
			});
			// History gets the tab's draft as typed: inherited credentials stay out.
			if (!(await recordSend(tab.draft, settled, queryClient))) {
				toast.show({
					tone: "error",
					title: t("apiClient.status.historyError"),
				});
			}
		},
		[latest, dispatch, sender, queryClient, toast, t],
	);

	const cancel = useCallback(
		(tabId: string) => {
			if (!controllers.current.has(tabId)) return;
			abort(tabId);
			dispatch({
				type: "setResponse",
				id: tabId,
				response: { kind: "cancelled" },
			});
		},
		[abort, dispatch],
	);

	return { send, cancel, abort };
}
