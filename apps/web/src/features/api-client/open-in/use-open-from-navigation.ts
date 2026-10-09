import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useWorkbenchState } from "../workbench/workbench-context";
import { readOpenInApiClient } from "./open-in-state";
import { useOpenMockRequests } from "./use-open-mock-requests";

/**
 * Opens the requests the project page asked for in `location.state`, once.
 * Waits until the saved drafts are restored, so the tab cap counts them,
 * then clears the state with a `replace` navigation: a reload or going
 * back to this entry does not open the tabs again.
 */
export function useOpenFromNavigation(): void {
	const location = useLocation();
	const navigate = useNavigate();
	const restoring = useWorkbenchState().syncStatus.state === "loading";
	const { open } = useOpenMockRequests();
	// History entry already handled (effects may run twice in development).
	const handledKey = useRef<string | null>(null);

	useEffect(() => {
		if (restoring || handledKey.current === location.key) return;
		const state: unknown = location.state;
		const target = readOpenInApiClient(state);
		if (!target) return;
		handledKey.current = location.key;
		const { pathname, search, hash } = location;
		void navigate({ pathname, search, hash }, { replace: true, state: null });
		void open(target);
	}, [restoring, location, navigate, open]);
}
