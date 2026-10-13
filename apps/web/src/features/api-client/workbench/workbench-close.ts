import type { WorkbenchState } from "./workbench-reducer";

/** Tab ids in bar order: requests, then pages. */
export const barIds = (state: WorkbenchState): string[] => [
	...state.tabs.map((tab) => tab.id),
	...state.pages.map((page) => page.id),
];

/**
 * Closes the tabs and pages in `ids`. When the active one closes, the
 * nearest one left takes over: the next to its right, else to its left.
 */
export function closeIds(
	state: WorkbenchState,
	ids: ReadonlySet<string>,
): WorkbenchState {
	const order = barIds(state);
	if (!order.some((id) => ids.has(id))) return state;
	const rest = {
		...state,
		tabs: state.tabs.filter((tab) => !ids.has(tab.id)),
		pages: state.pages.filter((page) => !ids.has(page.id)),
	};
	const active = state.activeTabId;
	if (active === null || !ids.has(active)) return rest;
	const index = order.indexOf(active);
	const kept = (id: string) => !ids.has(id);
	const next =
		order.slice(index + 1).find(kept) ??
		order.slice(0, index).reverse().find(kept) ??
		null;
	return { ...rest, activeTabId: next };
}
