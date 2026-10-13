import { type RefObject, useCallback, useMemo, useRef } from "react";
import {
	useWorkbenchActions,
	useWorkbenchState,
} from "../workbench/workbench-context";
import type { TabMenuActions } from "./tab-context-menu";
import { tabDomId } from "./tab-item";

/**
 * What the tab menus do. After an action moved or closed tabs, focus goes
 * to the active tab instead of the menu's trigger (which may be gone);
 * dismissing a menu still returns focus to its trigger.
 */
export function useTabMenuActions(
	activeId: RefObject<string | null>,
	requestClose: (ids: readonly string[]) => void,
): TabMenuActions {
	const { canOpenTab } = useWorkbenchState();
	const { activateTab, openTab, currentTabs } = useWorkbenchActions();
	const acted = useRef(false);

	const focusActive = useCallback(() => {
		const id = activeId.current;
		if (id) document.getElementById(tabDomId(id))?.focus();
	}, [activeId]);

	return useMemo<TabMenuActions>(() => {
		const marked =
			<A extends unknown[]>(run: (...args: A) => void) =>
			(...args: A) => {
				acted.current = true;
				run(...args);
			};
		return {
			canOpenTab,
			onNew: marked(() => openTab()),
			onDuplicate: marked((id: string) => {
				const tab = currentTabs().find((item) => item.id === id);
				if (!tab) return;
				openTab(tab.draft, { files: tab.files, redacted: tab.redacted });
			}),
			onClose: marked(requestClose),
			onActivate: marked(activateTab),
			onCloseAutoFocus: (event: Event) => {
				if (!acted.current) return;
				acted.current = false;
				event.preventDefault();
				requestAnimationFrame(focusActive);
			},
		};
	}, [
		canOpenTab,
		openTab,
		currentTabs,
		requestClose,
		activateTab,
		focusActive,
	]);
}
