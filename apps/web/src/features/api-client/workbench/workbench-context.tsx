/**
 * State and actions of the API client workbench for every panel of the
 * page: tabs, the active tab, draft sync and sending. Two contexts, so a
 * keystroke in the editor only re-renders what shows tab state: actions
 * never change (`useWorkbenchActions()`), tab state does
 * (`useWorkbenchState()`). `useWorkbench()` reads both.
 */
import {
	type ApiRequestDraft,
	DRAFT_MAX_TABS,
	createRequestDraft,
} from "@localman/shared/api-client";
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useMemo,
	useReducer,
	useRef,
} from "react";
import { useDraftSync } from "./use-draft-sync";
import { useSendTab } from "./use-send-tab";
import { newId } from "./workbench-ids";
import { INITIAL_WORKBENCH, workbenchReducer } from "./workbench-reducer";
import type {
	DraftSyncStatus,
	OpenTabOptions,
	RequestSender,
	SendOptions,
	WorkbenchTab,
} from "./workbench-types";

export interface WorkbenchState {
	tabs: readonly WorkbenchTab[];
	activeTabId: string | null;
	activeTab: WorkbenchTab | null;
	syncStatus: DraftSyncStatus;
	/** False at `DRAFT_MAX_TABS` open tabs. */
	canOpenTab: boolean;
}

/** Stable for the provider's life: safe as props of memoized panels. */
export interface WorkbenchActions {
	/** Opens a tab (a blank request by default); `null` when at the cap. */
	openTab: (draft?: ApiRequestDraft, options?: OpenTabOptions) => string | null;
	activateTab: (tabId: string) => void;
	/** Closes without asking (the tab bar asks first for a dirty tab). */
	closeTab: (tabId: string) => void;
	/** `update` must be pure and return the same object when nothing changed. */
	updateDraft: (
		tabId: string,
		update: (draft: ApiRequestDraft) => ApiRequestDraft,
	) => void;
	/** Keeps (or with `null` forgets) the bytes behind a `FileRef.fileId`. */
	setFile: (tabId: string, fileId: string, file: File | null) => void;
	/**
	 * Sends the tab's request; ignored while that tab is already sending.
	 * `options` apply to this send only (a retry through the proxy).
	 */
	send: (tabId: string, options?: SendOptions) => void;
	cancelSend: (tabId: string) => void;
	/** Saves pending drafts to the server now. */
	saveDrafts: () => void;
	/** The tabs right now, for a one-off read (export) without subscribing. */
	currentTabs: () => readonly WorkbenchTab[];
}

export type Workbench = WorkbenchState & WorkbenchActions;

const StateContext = createContext<WorkbenchState | null>(null);
const ActionsContext = createContext<WorkbenchActions | null>(null);

export interface WorkbenchProviderProps {
	children: ReactNode;
	/** The router on the page; tests pass their own. */
	sender: RequestSender;
	/** Request of a new blank tab (the account's default route…). */
	newDraft?: () => ApiRequestDraft;
	/** Debounce of draft saves in ms (tests shorten it). */
	saveDelayMs?: number;
	/** Waits between tries of a failed draft write (tests shorten them). */
	retryDelaysMs?: readonly number[];
}

export function WorkbenchProvider({
	children,
	sender,
	newDraft,
	saveDelayMs,
	retryDelaysMs,
}: WorkbenchProviderProps) {
	const [state, dispatch] = useReducer(workbenchReducer, INITIAL_WORKBENCH);
	const latest = useRef(state);
	latest.current = state;
	const sync = useDraftSync(state, dispatch, {
		delayMs: saveDelayMs,
		retryDelaysMs,
	});
	const {
		send: sendTab,
		cancel: cancelSend,
		abort,
	} = useSendTab(latest, dispatch, sender);

	const openTab = useCallback(
		(draft?: ApiRequestDraft, options: OpenTabOptions = {}) => {
			if (latest.current.tabs.length >= DRAFT_MAX_TABS) return null;
			const id = newId();
			dispatch({
				type: "open",
				id,
				draft: draft ?? newDraft?.() ?? createRequestDraft(),
				files: options.files ?? new Map(),
				activate: options.activate ?? true,
				redacted: options.redacted ?? false,
			});
			return id;
		},
		[newDraft],
	);

	const closeTab = useCallback(
		(tabId: string) => {
			abort(tabId);
			dispatch({ type: "close", id: tabId });
		},
		[abort],
	);

	const actions = useMemo<WorkbenchActions>(
		() => ({
			openTab,
			activateTab: (id) => dispatch({ type: "activate", id }),
			closeTab,
			updateDraft: (id, update) => dispatch({ type: "editDraft", id, update }),
			setFile: (id, fileId, file) =>
				dispatch({ type: "setFile", id, fileId, file }),
			send: (id, options) => void sendTab(id, options),
			cancelSend,
			saveDrafts: sync.flush,
			currentTabs: () => latest.current.tabs,
		}),
		[openTab, closeTab, sendTab, cancelSend, sync.flush],
	);

	const value = useMemo<WorkbenchState>(
		() => ({
			tabs: state.tabs,
			activeTabId: state.activeTabId,
			activeTab: state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
			syncStatus: sync.status,
			canOpenTab: state.tabs.length < DRAFT_MAX_TABS,
		}),
		[state, sync.status],
	);

	return (
		<ActionsContext.Provider value={actions}>
			<StateContext.Provider value={value}>{children}</StateContext.Provider>
		</ActionsContext.Provider>
	);
}

export function useWorkbenchActions(): WorkbenchActions {
	const actions = useContext(ActionsContext);
	if (!actions) throw new Error("useWorkbench needs a WorkbenchProvider");
	return actions;
}

export function useWorkbenchState(): WorkbenchState {
	const state = useContext(StateContext);
	if (!state) throw new Error("useWorkbench needs a WorkbenchProvider");
	return state;
}

/** State and actions together, for panels that show tab state anyway. */
export function useWorkbench(): Workbench {
	return { ...useWorkbenchState(), ...useWorkbenchActions() };
}
