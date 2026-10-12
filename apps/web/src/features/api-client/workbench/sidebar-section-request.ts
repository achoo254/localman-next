/**
 * Asks the workbench sidebar to show one of its sections, from outside
 * it (e.g. "Manage environments" in the tab bar's environment selector).
 * The mounted sidebar listens; with none mounted the request is a no-op.
 */
import { useEffect, useRef } from "react";
import type { SidebarSection } from "./sidebar-rail";

type Listener = (section: SidebarSection) => void;
const listeners = new Set<Listener>();

export function requestSidebarSection(section: SidebarSection): void {
	for (const listener of listeners) listener(section);
}

/** Runs `onRequest` for each request while the caller is mounted. */
export function useSidebarSectionRequests(onRequest: Listener): void {
	const handler = useRef(onRequest);
	handler.current = onRequest;
	useEffect(() => {
		const listener: Listener = (section) => handler.current(section);
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);
}
