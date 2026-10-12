/**
 * ARIA of an editor whose `{{` suggestions are open: the single-line
 * inputs become comboboxes; the multi-line body editor stays a textbox
 * (a combobox cannot be multi-line) and only points at the list.
 */
import { CONTEXT_SHORTCUT, type SuggestAria } from "./variable-assist-context";

export interface ComboboxAttributes {
	role: "combobox";
	"aria-autocomplete": "list";
	"aria-expanded": boolean;
	"aria-controls"?: string;
	"aria-activedescendant"?: string;
	"aria-keyshortcuts": string;
}

export function comboboxAttributes(
	aria: SuggestAria | null,
): ComboboxAttributes {
	return {
		role: "combobox",
		"aria-autocomplete": "list",
		"aria-expanded": aria !== null,
		...listAttributes(aria),
		"aria-keyshortcuts": CONTEXT_SHORTCUT,
	};
}

/** `aria-controls` and `aria-activedescendant` while the list shows. */
export function listAttributes(
	aria: SuggestAria | null,
): Record<string, string> {
	if (!aria) return {};
	return {
		"aria-controls": aria.listId,
		...(aria.activeId ? { "aria-activedescendant": aria.activeId } : {}),
	};
}
