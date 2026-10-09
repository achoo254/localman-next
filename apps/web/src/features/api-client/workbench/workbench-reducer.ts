/**
 * Tabs of the workbench as a pure reducer: open, switch, edit, close, and
 * each tab's response. Server sync and sending live outside (they react
 * to this state), so every transition here is testable without fetch.
 */
import {
	type ApiRequestDraft,
	DRAFT_MAX_TABS,
	createRequestDraft,
} from "@localman/shared/api-client";
import type { TabResponse, WorkbenchTab } from "./workbench-types";

export interface WorkbenchState {
	tabs: WorkbenchTab[];
	activeTabId: string | null;
}

export type WorkbenchAction =
	| { type: "restore"; tabs: { id: string; draft: ApiRequestDraft }[] }
	| {
			type: "open";
			id: string;
			draft: ApiRequestDraft;
			files: ReadonlyMap<string, File>;
			activate: boolean;
			redacted: boolean;
	  }
	| { type: "activate"; id: string }
	| { type: "close"; id: string }
	| {
			type: "editDraft";
			id: string;
			/** Pure: React may call it twice in development. */
			update: (draft: ApiRequestDraft) => ApiRequestDraft;
	  }
	| { type: "setFile"; id: string; fileId: string; file: File | null }
	| { type: "setResponse"; id: string; response: TabResponse };

export const INITIAL_WORKBENCH: WorkbenchState = {
	tabs: [],
	activeTabId: null,
};

const NO_FILES: ReadonlyMap<string, File> = new Map();
const IDLE: TabResponse = { kind: "idle" };

/** JSON with sorted keys, so two drafts compare by content only. */
function stableJson(value: unknown): string {
	return JSON.stringify(value, (_key, inner: unknown) => {
		if (inner === null || typeof inner !== "object" || Array.isArray(inner)) {
			return inner;
		}
		const entries = Object.entries(inner);
		entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return Object.fromEntries(entries);
	});
}

const BLANK = stableJson(createRequestDraft());

/** A new, untouched request (settings and route included). */
export function isBlankDraft(draft: ApiRequestDraft): boolean {
	return stableJson(draft) === BLANK;
}

function newTab(
	id: string,
	draft: ApiRequestDraft,
	files: ReadonlyMap<string, File>,
	dirty: boolean,
	redacted = false,
): WorkbenchTab {
	return {
		id,
		draft,
		dirty,
		files,
		response: IDLE,
		routeChosen: false,
		redacted,
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

/** The neighbour that takes focus when the active tab closes. */
function nextActive(tabs: WorkbenchTab[], closedIndex: number): string | null {
	const next = tabs[closedIndex] ?? tabs[closedIndex - 1];
	return next ? next.id : null;
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
				.map(({ id, draft }) =>
					newTab(id, draft, NO_FILES, !isBlankDraft(draft)),
				);
			const tabs = [...restored, ...state.tabs];
			return { tabs, activeTabId: state.activeTabId ?? tabs[0]?.id ?? null };
		}
		case "open": {
			if (state.tabs.length >= DRAFT_MAX_TABS) return state;
			if (state.tabs.some((tab) => tab.id === action.id)) return state;
			const { id, draft, files, redacted } = action;
			const tab = newTab(id, draft, files, false, redacted);
			return {
				tabs: [...state.tabs, tab],
				activeTabId:
					action.activate || state.activeTabId === null
						? action.id
						: state.activeTabId,
			};
		}
		case "activate":
			return state.tabs.some((tab) => tab.id === action.id)
				? { ...state, activeTabId: action.id }
				: state;
		case "close": {
			const index = state.tabs.findIndex((tab) => tab.id === action.id);
			if (index === -1) return state;
			const tabs = state.tabs.filter((tab) => tab.id !== action.id);
			const activeTabId =
				state.activeTabId === action.id
					? nextActive(tabs, index)
					: state.activeTabId;
			return { tabs, activeTabId };
		}
		case "editDraft":
			return mapTab(state, action.id, (tab) => {
				const draft = action.update(tab.draft);
				if (draft === tab.draft) return tab;
				// Only an edit sets a route: one that came with the draft is no choice.
				const routeChosen =
					tab.routeChosen || draft.settings.route !== tab.draft.settings.route;
				return { ...tab, draft, dirty: true, routeChosen };
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
