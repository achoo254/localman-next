import { type ReactNode, createContext } from "react";
import type { WorkbenchTab } from "../workbench/workbench-types";

/**
 * Where an `inherit` request takes its auth from, for the Authorization
 * pane: given by the collections feature for tabs bound to a collection
 * request; `null` (or no provider) keeps the "no parent" note.
 */
export type InheritNoteOf = (tab: WorkbenchTab) => ReactNode | null;

export const AuthInheritContext = createContext<InheritNoteOf | null>(null);
