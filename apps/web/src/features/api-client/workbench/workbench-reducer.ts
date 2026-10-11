/**
 * Tabs of the workbench as a pure reducer: open, switch, edit, close, and
 * each tab's response. Server sync and sending live outside (they react
 * to this state), so every transition here is testable without fetch.
 */
import {
	type ApiRequestDraft,
	DRAFT_MAX_TABS,
} from "@localman/shared/api-client";
import { isBlankDraft, isDirty } from "./draft-compare";
import type { WorkbenchAction } from "./workbench-action";
import type { PageTab } from "./workbench-tab-types";
import type { TabResponse, WorkbenchTab } from "./workbench-types";

export { isBlankDraft };

export interface WorkbenchState {
	tabs: WorkbenchTab[];
	/** Collection and folder pages, after the request tabs in the bar. */
	pages: PageTab[];
	/** A request tab or a page. */
	activeTabId: string | null;
}

export const INITIAL_WORKBENCH: WorkbenchState = {
	tabs: [],
	pages: [],
	activeTabId: null,
};

const NO_FILES: ReadonlyMap<string, File> = new Map();
const IDLE: TabResponse = { kind: "idle" };

function newTab(
	id: string,
	draft: ApiRequestDraft,
	files: ReadonlyMap<string, File>,
	dirty: boolean,
	extra: Partial<Pick<WorkbenchTab, "redacted" | "source" | "saved">> = {},
): WorkbenchTab {
	return {
		id,
		draft,
		dirty,
		files,
		response: IDLE,
		routeChosen: false,
		redacted: extra.redacted ?? false,
		source: extra.source ?? null,
		saved: extra.saved ?? null,
	};
}

function mapTab(
	state: WorkbenchState,
	id: string,
	update: (tab: WorkbenchTab) => WorkbenchTab,
): WorkbenchState {
	if (!state.tabs.some((tab) => tab.id === id)) return state;
	return {
		...state,
		tabs: state.tabs.map((tab) => (tab.id === id ? update(tab) : tab)),
	};
}

/** Tab ids in bar order: requests, then pages. */
const barIds = (state: WorkbenchState): string[] => [
	...state.tabs.map((tab) => tab.id),
	...state.pages.map((page) => page.id),
];

/** The neighbour that takes focus when the active tab closes. */
function nextActive(ids: string[], closedIndex: number): string | null {
	return ids[closedIndex] ?? ids[closedIndex - 1] ?? null;
}

export function workbenchReducer(
	state: WorkbenchState,
	action: WorkbenchAction,
): WorkbenchState {
	switch (action.type) {
		case "restore": {
			// Tabs opened while the list was loading stay after the restored
			// ones, within the cap: the server refuses a draft past it.
			const known = new Set(state.tabs.map((tab) => tab.id));
			const room = Math.max(0, DRAFT_MAX_TABS - state.tabs.length);
			const restored = action.tabs
				.filter(({ id }) => !known.has(id))
				.slice(0, room)
				.map(({ id, draft, source }) =>
					newTab(id, draft, NO_FILES, !isBlankDraft(draft), { source }),
				);
			const tabs = [...restored, ...state.tabs];
			const activeTabId = state.activeTabId ?? tabs[0]?.id ?? null;
			return { ...state, tabs, activeTabId };
		}
		case "open": {
			if (state.tabs.length >= DRAFT_MAX_TABS) return state;
			if (state.tabs.some((tab) => tab.id === action.id)) return state;
			const { id, draft, files, redacted, source, saved } = action;
			const dirty = saved !== undefined && isDirty(draft, saved);
			const tab = newTab(id, draft, files, dirty, { redacted, source, saved });
			return {
				...state,
				tabs: [...state.tabs, tab],
				activeTabId:
					action.activate || state.activeTabId === null
						? action.id
						: state.activeTabId,
			};
		}
		case "openPage": {
			const known = state.pages.some((page) => page.id === action.page.id);
			const pages = known ? state.pages : [...state.pages, action.page];
			return { ...state, pages, activeTabId: action.page.id };
		}
		case "renamePage":
			return {
				...state,
				pages: state.pages.map((page) =>
					page.id === action.id ? { ...page, name: action.name } : page,
				),
			};
		case "activate":
			return barIds(state).includes(action.id)
				? { ...state, activeTabId: action.id }
				: state;
		case "close": {
			const index = barIds(state).indexOf(action.id);
			if (index === -1) return state;
			const tabs = state.tabs.filter((tab) => tab.id !== action.id);
			const pages = state.pages.filter((page) => page.id !== action.id);
			const rest = { ...state, tabs, pages };
			const activeTabId =
				state.activeTabId === action.id
					? nextActive(barIds(rest), index)
					: state.activeTabId;
			return { ...rest, activeTabId };
		}
		case "bind":
			return mapTab(state, action.id, (tab) => ({
				...tab,
				source: action.source,
				saved: action.saved,
				dirty: isDirty(tab.draft, action.saved),
			}));
		case "setSaved":
			return mapTab(state, action.id, (tab) => ({
				...tab,
				saved: action.saved,
				dirty: isDirty(tab.draft, action.saved),
			}));
		case "editDraft":
			return mapTab(state, action.id, (tab) => {
				const draft = action.update(tab.draft);
				if (draft === tab.draft) return tab;
				// Only an edit sets a route: one that came with the draft is no choice.
				const routeChosen =
					tab.routeChosen || draft.settings.route !== tab.draft.settings.route;
				const dirty = tab.saved === null || isDirty(draft, tab.saved);
				return { ...tab, draft, dirty, routeChosen };
			});
		case "setFile":
			return mapTab(state, action.id, (tab) => {
				const files = new Map(tab.files);
				if (action.file) files.set(action.fileId, action.file);
				else files.delete(action.fileId);
				return { ...tab, files };
			});
		case "setResponse":
			return mapTab(state, action.id, (tab) => ({
				...tab,
				response: action.response,
			}));
	}
}
