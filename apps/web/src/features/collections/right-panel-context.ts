import { createContext, useContext } from "react";

export const RIGHT_PANELS = ["info", "comments", "changelog"] as const;
export type RightPanel = (typeof RIGHT_PANELS)[number];

export interface RightPanelState {
	/** The open panel; `null` when the rail is folded. */
	panel: RightPanel | null;
	setPanel: (panel: RightPanel | null) => void;
}

const CLOSED: RightPanelState = { panel: null, setPanel: () => {} };

/** Which panel of the right rail is open, shared with "Open changelog". */
export const RightPanelContext = createContext<RightPanelState>(CLOSED);

export function useRightPanel(): RightPanelState {
	return useContext(RightPanelContext);
}
