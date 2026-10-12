/**
 * Keeps the server's drafts in step with the open tabs: saves a tab's
 * draft once it has stopped changing for `delayMs` (with its position as
 * `order`), deletes it when the tab closes. Writes of one tab run in turn,
 * so a late save cannot revive a closed tab. A write failing for a passing
 * reason is tried again (`draft-retry.ts`); leaving the page sends what
 * waits with `keepalive`. A tab's collection binding goes with its saves
 * (`use-binding-writes.ts`); the drafts come back on mount
 * (`use-draft-restore.ts`).
 */
import type { ApiRequestDraft } from "@localman/shared/api-client";
import { type Dispatch, useCallback, useEffect, useRef, useState } from "react";
import { activeTranslator } from "../../../i18n/active-translator";
import { errorMessage } from "../../../lib/api-client";
import {
	KEEPALIVE_MAX_BYTES,
	deleteDraft,
	draftSaveBody,
	saveDraft,
	saveDraftOnLeave,
} from "../api/draft-api";
import {
	DRAFT_RETRY_DELAYS_MS,
	isTransientError,
	withRetries,
} from "./draft-retry";
import { useBindingWrites } from "./use-binding-writes";
import { useDraftRestore } from "./use-draft-restore";
import type { WorkbenchAction } from "./workbench-action";
import type { WorkbenchState } from "./workbench-reducer";
import type { DraftSyncStatus } from "./workbench-tab-types";

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
	const binding = useBindingWrites();
	const timers = useRef(new Map<string, number>());
	const queues = useRef(new Map<string, Promise<void>>());
	const running = useRef(0);
	// Writes outlive an unmount (`flush`); their status then has nowhere to go.
	const mounted = useRef(true);

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
					if (running.current === 0 && mounted.current)
						setStatus({ state: "saved" });
				} catch (error) {
					running.current -= 1;
					if (!mounted.current) return;
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
			const source = binding.write(tabId, tab.source);
			enqueue(tabId, () => saveDraft(tabId, tab.draft, order, source));
		},
		[enqueue, binding],
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
			const source = binding.peek(tabId, tab.source);
			const body = draftSaveBody(tab.draft, order, source);
			if (body.bytes > budget) continue;
			binding.write(tabId, tab.source);
			budget -= body.bytes;
			window.clearTimeout(timers.current.get(tabId));
			timers.current.delete(tabId);
			enqueue(tabId, () => saveDraftOnLeave(tabId, body.json));
		}
	}, [enqueue, binding]);

	useDraftRestore(dispatch, seen, binding, setStatus);

	useEffect(() => {
		const open = new Set<string>();
		for (const tab of state.tabs) {
			open.add(tab.id);
			const rebound = binding.changed(tab.id, tab.source);
			if (seen.current.get(tab.id) === tab.draft && !rebound) continue;
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
			binding.forget(tabId);
			window.clearTimeout(timers.current.get(tabId));
			timers.current.delete(tabId);
			enqueue(tabId, () => deleteDraft(tabId));
		}
	}, [state.tabs, delayMs, saveNow, enqueue, binding]);

	// Leaving the page (or the tab going to the background) saves what waits.
	useEffect(() => {
		mounted.current = true;
		const onHide = () => {
			if (document.visibilityState === "hidden") flushOnLeave();
		};
		window.addEventListener("pagehide", flushOnLeave);
		document.addEventListener("visibilitychange", onHide);
		return () => {
			window.removeEventListener("pagehide", flushOnLeave);
			document.removeEventListener("visibilitychange", onHide);
			flush();
			mounted.current = false;
		};
	}, [flush, flushOnLeave]);

	return { status, flush };
}
