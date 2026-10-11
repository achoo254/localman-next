/** What `useWorkbenchState()` and `useWorkbenchActions()` give panels. */
import type { ApiRequestDraft, TabSource } from "@localman/shared/api-client";
import type {
	DraftSyncStatus,
	OpenTabOptions,
	PageTab,
} from "./workbench-tab-types";
import type { SendOptions, WorkbenchTab } from "./workbench-types";

export interface WorkbenchState {
	tabs: readonly WorkbenchTab[];
	/** Collection and folder pages (after the requests in the tab bar). */
	pages: readonly PageTab[];
	activeTabId: string | null;
	/** The active tab when it is a request. */
	activeTab: WorkbenchTab | null;
	/** The active tab when it is a page. */
	activePage: PageTab | null;
	syncStatus: DraftSyncStatus;
	/** False at `DRAFT_MAX_TABS` open tabs. */
	canOpenTab: boolean;
}

/** Stable for the provider's life: safe as props of memoized panels. */
export interface WorkbenchActions {
	/** Opens a tab (a blank request by default); `null` when at the cap. */
	openTab: (draft?: ApiRequestDraft, options?: OpenTabOptions) => string | null;
	/** Opens (or shows again) a collection or folder page. */
	openPage: (page: PageTab) => void;
	renamePage: (pageId: string, name: string) => void;
	/** Pages from an earlier visit, added after the open ones. */
	restorePages: (pages: PageTab[]) => void;
	/** The pages right now, for a one-off read. */
	currentPages: () => readonly PageTab[];
	activateTab: (tabId: string) => void;
	/** Closes without asking (the tab bar asks first for a dirty tab). */
	closeTab: (tabId: string) => void;
	/** `update` must be pure and return the same object when nothing changed. */
	updateDraft: (
		tabId: string,
		update: (draft: ApiRequestDraft) => ApiRequestDraft,
	) => void;
	/** Binds a tab to a collection request (`null` unbinds it). */
	bindTab: (
		tabId: string,
		source: TabSource | null,
		saved: ApiRequestDraft | null,
	) => void;
	/** The bound request as now stored: the tab is clean when they match. */
	setSaved: (tabId: string, saved: ApiRequestDraft) => void;
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
