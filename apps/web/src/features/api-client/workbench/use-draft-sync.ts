/**
 * Keeps the server's drafts in step with the open tabs: restores them on
 * mount, saves a tab's draft once it has stopped changing for `delayMs`
 * (with its position as `order`), deletes it when the tab closes. Writes
 * of one tab run one after another, so a late save cannot revive a tab
 * that was just closed. A write failing for a passing reason is tried
 * again (`draft-retry.ts`); leaving the page sends what waits with
 * `keepalive`, so the last edits survive the tab closing.
 */
import type { ApiRequestDraft } from "@localman/shared/api-client";
import { type Dispatch, useCallback, useEffect, useRef, useState } from "react";
import { activeTranslator } from "../../../i18n/active-translator";
import { errorMessage } from "../../../lib/api-client";
import {
	KEEPALIVE_MAX_BYTES,
	deleteDraft,
	draftSaveBody,
	listDrafts,
	saveDraft,
	saveDraftOnLeave,
} from "../api/draft-api";
import {
	DRAFT_RETRY_DELAYS_MS,
	isTransientError,
	withRetries,
} from "./draft-retry";
import type { WorkbenchAction, WorkbenchState } from "./workbench-reducer";
import type { DraftSyncStatus } from "./workbench-types";

export const DRAFT_SAVE_DELAY_MS = 800;

export interface DraftSync {
	status: DraftSyncStatus;
	/** Saves every pending draft now (Ctrl/Cmd+S). */
	flush: () => void;
}

export interface DraftSyncOptions {
	/** Debounce of saves in ms. */
	delayMs?: number;
	/** Waits between tries of a failed write (tests shorten them). */
	retryDelaysMs?: readonly number[];
}

export function useDraftSync(
	state: WorkbenchState,
	dispatch: Dispatch<WorkbenchAction>,
	{
		delayMs = DRAFT_SAVE_DELAY_MS,
		retryDelaysMs = DRAFT_RETRY_DELAYS_MS,
	}: DraftSyncOptions = {},
): DraftSync {
	const [status, setStatus] = useState<DraftSyncStatus>({ state: "loading" });
	const latest = useRef(state);
	latest.current = state;
	/** Draft object last handed to the server (or restored from it), by tab. */
	const seen = useRef(new Map<string, ApiRequestDraft>());
	const timers = useRef(new Map<string, number>());
	const queues = useRef(new Map<string, Promise<void>>());
	const running = useRef(0);

	// Stays "saving" while a write is tried again; "error" once it gives up.
	const enqueue = useCallback(
		(tabId: string, write: () => Promise<void>) => {
			running.current += 1;
			setStatus({ state: "saving" });
			const previous = queues.current.get(tabId) ?? Promise.resolve();
			const next = previous.then(async () => {
				try {
					await withRetries(write, retryDelaysMs);
					running.current -= 1;
					if (running.current === 0) setStatus({ state: "saved" });
				} catch (error) {
					running.current -= 1;
					// Still open: its next change of tabs schedules the save again.
					const open = latest.current.tabs.some((tab) => tab.id === tabId);
					if (open && isTransientError(error)) seen.current.delete(tabId);
					const message = activeTranslator().t("apiClient.status.draftError", {
						message: errorMessage(error),
					});
					setStatus({ state: "error", message });
				}
			});
			queues.current.set(tabId, next);
		},
		[retryDelaysMs],
	);

	const saveNow = useCallback(
		(tabId: string) => {
			window.clearTimeout(timers.current.get(tabId));
			timers.current.delete(tabId);
			const order = latest.current.tabs.findIndex((tab) => tab.id === tabId);
			const tab = latest.current.tabs[order];
			if (!tab) return;
			enqueue(tabId, () => saveDraft(tabId, tab.draft, order));
		},
		[enqueue],
	);

	const flush = useCallback(() => {
		for (const tabId of [...timers.current.keys()]) saveNow(tabId);
	}, [saveNow]);

	/**
	 * The page is going away: what waits goes out with `keepalive`, within
	 * its 64 KiB budget. A bigger draft keeps its timer, which still saves
	 * it if the page only went to the background.
	 */
	const flushOnLeave = useCallback(() => {
		let budget = KEEPALIVE_MAX_BYTES;
		for (const tabId of [...timers.current.keys()]) {
			const order = latest.current.tabs.findIndex((tab) => tab.id === tabId);
			const tab = latest.current.tabs[order];
			if (!tab) continue;
			const body = draftSaveBody(tab.draft, order);
			if (body.bytes > budget) continue;
			budget -= body.bytes;
			window.clearTimeout(timers.current.get(tabId));
			timers.current.delete(tabId);
			enqueue(tabId, () => saveDraftOnLeave(tabId, body.json));
		}
	}, [enqueue]);

	// Restore once; tabs opened meanwhile keep their place after these.
	useEffect(() => {
		let active = true;
		listDrafts()
			.then((items) => {
				if (!active) return;
				for (const item of items) seen.current.set(item.tabId, item.draft);
				dispatch({
					type: "restore",
					tabs: items.map(({ tabId, draft }) => ({ id: tabId, draft })),
				});
				setStatus((current) =>
					current.state === "loading" ? { state: "idle" } : current,
				);
			})
			.catch((error: unknown) => {
				if (!active) return;
				const message = activeTranslator().t("apiClient.status.loadError", {
					message: errorMessage(error),
				});
				setStatus({ state: "error", message });
			});
		return () => {
			active = false;
		};
	}, [dispatch]);

	useEffect(() => {
		const open = new Set<string>();
		for (const tab of state.tabs) {
			open.add(tab.id);
			if (seen.current.get(tab.id) === tab.draft) continue;
			seen.current.set(tab.id, tab.draft);
			window.clearTimeout(timers.current.get(tab.id));
			timers.current.set(
				tab.id,
				window.setTimeout(() => saveNow(tab.id), delayMs),
			);
		}
		for (const tabId of [...seen.current.keys()]) {
			if (open.has(tabId)) continue;
			seen.current.delete(tabId);
			window.clearTimeout(timers.current.get(tabId));
			timers.current.delete(tabId);
			enqueue(tabId, () => deleteDraft(tabId));
		}
	}, [state.tabs, delayMs, saveNow, enqueue]);

	// Leaving the page (or the tab going to the background) saves what waits.
	useEffect(() => {
		const onHide = () => {
			if (document.visibilityState === "hidden") flushOnLeave();
		};
		window.addEventListener("pagehide", flushOnLeave);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("pagehide", flushOnLeave);
			document.removeEventListener("visibilitychange", onHide);
			flush();
		};
	}, [flush, flushOnLeave]);

	return { status, flush };
}
