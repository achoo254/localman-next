/**
 * Sending for the workbench: one request in flight per tab, cancellable,
 * its outcome stored as the tab's response, then recorded in history.
 */
import type { ScriptScopeChanges } from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type RefObject, useCallback, useRef } from "react";
import { useToast } from "../../../components/ui/toast";
import { activeTranslator } from "../../../i18n/active-translator";
import { useT } from "../../../i18n/i18n-context";
import { recordSend } from "./record-send";
import type { SaveScopes, SendHooks } from "./send-hooks";
import { failed } from "./send-steps";
import type { RequestSender, SendOptions } from "./send-types";
import { withTemporaryLayer } from "./temporary-variables";
import type { WorkbenchAction } from "./workbench-action";
import type { WorkbenchState } from "./workbench-reducer";
import type { SendContext } from "./workbench-tab-types";
import type { SettledResponse, WorkbenchTab } from "./workbench-types";

export interface SendTab {
	send: (tabId: string, options?: SendOptions) => Promise<void>;
	cancel: (tabId: string) => void;
	/** Stops a send without a response update (the tab is closing). */
	abort: (tabId: string) => void;
}

const UNAVAILABLE = Symbol("variables unavailable");

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
	hooks: SendHooks = {},
): SendTab {
	const t = useT();
	const toast = useToast();
	const queryClient = useQueryClient();
	const controllers = useRef(new Map<string, AbortController>());
	// Read at send time, so a new function does not change `send`.
	const hooksOf = useRef(hooks);
	hooksOf.current = hooks;
	// The variables could not be read: the send stops and says why. The
	// tab's temporary variables go on top of whatever was read.
	const variablesFor = useCallback(
		async (tab: WorkbenchTab, context: SendContext | null) => {
			try {
				const layers = await hooksOf.current.variablesOf?.(tab, context);
				return withTemporaryLayer(layers, context, tab.temporary);
			} catch {
				return UNAVAILABLE;
			}
		},
		[],
	);

	// Saves the scripts' scope changes; says what was dropped or failed.
	const keepScopes = useCallback(
		async (save: ReturnType<SaveScopes>, changes: ScriptScopeChanges) => {
			const { saved, dropped } = await save(changes);
			if (dropped.length > 0) {
				const scopes = dropped
					.map((scope) => t(`apiClient.send.scopeNames.${scope}`))
					.join(", ");
				toast.show({
					tone: "info",
					title: t("apiClient.send.scopesDropped", { scopes }),
				});
			}
			if (!saved) {
				toast.show({
					tone: "error",
					title: t("apiClient.send.scopesNotSaved"),
				});
			}
		},
		[t, toast],
	);

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
			let changes: ScriptScopeChanges | null = null;
			// Where script changes go is fixed at the click, before any await.
			const saveChanges = hooksOf.current.saveScopes?.(
				tab.source?.collectionId ?? null,
			);
			try {
				const { draft, files, routeChosen } = tab;
				const resolve = hooksOf.current.sendContext;
				const found = tab.source && resolve ? await resolve(tab) : null;
				const context = found && "context" in found ? found.context : null;
				const variables = await variablesFor(tab, context);
				settled =
					found && "unavailable" in found
						? failed({
								code: "COLLECTION_UNAVAILABLE",
								message: found.unavailable,
							})
						: variables === UNAVAILABLE
							? failed({
									code: "VARIABLES_UNAVAILABLE",
									message: t("apiClient.send.variablesUnavailable"),
								})
							: await sender({
									draft,
									files,
									signal: controller.signal,
									routeChosen,
									...(options ? { options } : {}),
									...(context ? { context } : {}),
									...(variables ? { variables } : {}),
									onScopeChanges: (latest) => {
										changes = latest;
									},
								});
			} catch {
				// Senders never reject; a bug in one must not leave the tab spinning.
				settled = senderBug();
			}
			// Done, failed or cancelled: what the scripts set is kept.
			const keep =
				changes && saveChanges ? keepScopes(saveChanges, changes) : null;
			if (controllers.current.get(tabId) !== controller) {
				await keep;
				return;
			}
			controllers.current.delete(tabId);
			dispatch({
				type: "setResponse",
				id: tabId,
				response:
					settled.kind === "done" ? { ...settled, draft: tab.draft } : settled,
			});
			await keep;
			// History gets the tab's draft as typed: inherited credentials stay out.
			if (!(await recordSend(tab.draft, settled, queryClient))) {
				toast.show({
					tone: "error",
					title: t("apiClient.status.historyError"),
				});
			}
		},
		[latest, dispatch, sender, variablesFor, keepScopes, queryClient, toast, t],
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
