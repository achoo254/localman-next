import { createContext } from "react";

/**
 * Lets an open collection or folder page hand its "save now" to the
 * workbench's Ctrl/Cmd+S (`null` when the page goes away).
 */
export type RegisterPageSave = (
	pageId: string,
	flush: (() => void) | null,
) => void;

export const PageSaveContext = createContext<RegisterPageSave | null>(null);
