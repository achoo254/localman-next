/**
 * What the request editors share with the variable assist of the open
 * tab: the layers and a classifier to colour `{{name}}` (changes with the
 * data), and stable actions for the hover card, `{{` suggestions and
 * "Set as variable". Outside a provider, or with environments off, both
 * are `null` and the editors behave as before.
 */
import type { ResolverLayer } from "@localman/shared/api-client";
import { createContext, useContext } from "react";
import type { VariableKind } from "./variable-kinds";

export interface VariableAssistData {
	layers: readonly ResolverLayer[];
	classify: (name: string) => VariableKind;
}

/** Measures the anchor again (it moves when its editor scrolls). */
export type AnchorRect = () => DOMRect | null;

/** What an editor exposes as a combobox while its suggestions show. */
export interface SuggestAria {
	listId: string;
	activeId: string | null;
}

export interface SuggestRequest {
	/** The editor asking; only it may close what it opened. */
	owner: object;
	query: string;
	anchor: AnchorRect;
	pick: (name: string) => void;
	/** The list's id and active option for the editor's ARIA; `null` once closed. */
	onAria?: (aria: SuggestAria | null) => void;
}

/** The DOM id of a suggestion, for `aria-activedescendant`. */
export const suggestOptionId = (listId: string, index: number): string =>
	`${listId}-option-${index}`;

export interface VariableAssistActions {
	/** Pointer over a `{{name}}`: shows its card next to `rect`. */
	hover: (name: string, rect: DOMRect) => void;
	/** Pointer left: hides the card after a short delay. */
	unhover: () => void;
	/**
	 * Shows the card from the keyboard and moves focus into it; Escape
	 * gives focus back to `returnTo`.
	 */
	focusCard: (name: string, rect: DOMRect, returnTo: HTMLElement) => void;
	suggest: (request: SuggestRequest) => void;
	closeSuggest: (owner: object) => void;
	/**
	 * A key while suggestions show; `true` when the list used it. Keys
	 * with a modifier (Shift+Tab…) are left to the editor.
	 */
	suggestKey: (key: string, modified?: boolean) => boolean;
	/** Text selected in an editor: offers "Set as variable" near it. */
	select: (owner: object, text: string, anchor: AnchorRect) => void;
	unselect: (owner: object) => void;
	/** Opens "Set as variable" with `value` prefilled. */
	setAsVariable: (value: string) => void;
}

export const VariableAssistDataContext =
	createContext<VariableAssistData | null>(null);
export const VariableAssistActionsContext =
	createContext<VariableAssistActions | null>(null);

export interface VariableAssist {
	data: VariableAssistData;
	actions: VariableAssistActions;
}

/** Both parts, or `null` when no assist applies here. */
export function useVariableAssist(): VariableAssist | null {
	const data = useContext(VariableAssistDataContext);
	const actions = useContext(VariableAssistActionsContext);
	return data && actions ? { data, actions } : null;
}

/** Shift+F10 or the menu key: the keyboard way to the context actions. */
export function isContextKey(event: {
	key: string;
	shiftKey: boolean;
}): boolean {
	return event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);
}

export const CONTEXT_SHORTCUT = "Shift+F10";
