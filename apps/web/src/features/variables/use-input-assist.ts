/**
 * The variable assist for a single-line input whose `{{name}}`s are
 * coloured by an overlay copy of its text (`VariableInput`): the overlay
 * gives the geometry, so hovering a coloured variable opens its card, the
 * suggestions sit under the caret, and "Set as variable" sits under the
 * selection. Inactive (no handlers) outside a variable assist.
 */
import {
	type KeyboardEvent,
	type MouseEvent,
	type RefObject,
	type SyntheticEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { containsPoint, overlayRect } from "./rect";
import { type ComboboxAttributes, comboboxAttributes } from "./suggest-aria";
import {
	type SuggestAria,
	isContextKey,
	useVariableAssist,
} from "./variable-assist-context";
import type { VariableKind } from "./variable-kinds";
import {
	applyEdit,
	findVariableSpans,
	spanAt,
	suggestionAt,
	suggestionEdit,
} from "./variable-spans";

export interface InputAssistHandlers {
	onMouseMove: (event: MouseEvent<HTMLInputElement>) => void;
	onMouseLeave: () => void;
	onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
	onSelect: (event: SyntheticEvent<HTMLInputElement>) => void;
	onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => void;
	onMouseUp: (event: MouseEvent<HTMLInputElement>) => void;
	onBlur: () => void;
}

export interface InputAssist {
	classify: (name: string) => VariableKind;
	handlers: InputAssistHandlers;
	attributes: ComboboxAttributes;
	/** Call after each change with the input, to offer suggestions. */
	changed: (input: HTMLInputElement) => void;
}

export function useInputAssist(
	overlay: RefObject<HTMLElement | null>,
	onValueChange: (value: string) => void,
): InputAssist | null {
	const assist = useVariableAssist();
	const owner = useRef({}).current;
	const open = useRef(false);
	const change = useRef(onValueChange);
	change.current = onValueChange;
	const actions = assist?.actions ?? null;
	const [aria, setAria] = useState<SuggestAria | null>(null);
	// Same list and option: keep the state, so the input does not render again.
	const showAria = useRef((next: SuggestAria | null) =>
		setAria((current) =>
			current?.listId === next?.listId && current?.activeId === next?.activeId
				? current
				: next,
		),
	).current;

	useEffect(() => {
		if (!actions) return;
		return () => {
			actions.closeSuggest(owner);
			actions.unselect(owner);
		};
	}, [actions, owner]);

	if (!assist || !actions) return null;

	const complete = (input: HTMLInputElement, name: string) => {
		const caret = input.selectionStart ?? input.value.length;
		const target = suggestionAt(input.value, caret);
		if (!target) return;
		const edit = suggestionEdit(input.value, target, caret, name);
		change.current(applyEdit(input.value, edit));
		requestAnimationFrame(() =>
			input.setSelectionRange(edit.caret, edit.caret),
		);
	};

	const offer = (input: HTMLInputElement, typed: boolean) => {
		const { selectionStart: start, selectionEnd: end } = input;
		const caret = start !== null && start === end ? start : null;
		if (!typed && !open.current) return;
		const target = caret === null ? null : suggestionAt(input.value, caret);
		open.current = target !== null;
		if (!target) {
			actions.closeSuggest(owner);
			return;
		}
		actions.suggest({
			owner,
			query: target.query,
			anchor: () =>
				overlayRect(overlay.current, input, input.selectionStart ?? 0),
			pick: (name) => complete(input, name),
			onAria: showAria,
		});
	};

	/** Offers "Set as variable" for a selection; moves open suggestions. */
	const track = (input: HTMLInputElement) => {
		const start = input.selectionStart ?? 0;
		const end = input.selectionEnd ?? start;
		if (end > start) {
			actions.select(owner, input.value.slice(start, end), () =>
				overlayRect(overlay.current, input, end),
			);
		} else actions.unselect(owner);
		offer(input, false);
	};

	const handlers: InputAssistHandlers = {
		onMouseMove: (event) => {
			const marks = overlay.current?.querySelectorAll("[data-var]") ?? [];
			for (const mark of marks) {
				const rect = mark.getBoundingClientRect();
				const name = mark.getAttribute("data-var");
				if (name && containsPoint(rect, event.clientX, event.clientY)) {
					actions.hover(name, rect);
					return;
				}
			}
			actions.unhover();
		},
		onMouseLeave: () => actions.unhover(),
		onKeyDown: (event) => {
			const modified =
				event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
			if (actions.suggestKey(event.key, modified)) {
				event.preventDefault();
				return;
			}
			if (!isContextKey(event)) return;
			const input = event.currentTarget;
			const start = input.selectionStart ?? 0;
			const end = input.selectionEnd ?? start;
			if (end > start) {
				event.preventDefault();
				actions.setAsVariable(input.value.slice(start, end));
				return;
			}
			const span = spanAt(findVariableSpans(input.value), start);
			const mark = span
				? overlay.current?.querySelector(`[data-from="${span.from}"]`)
				: null;
			if (!span || !mark) return;
			event.preventDefault();
			actions.focusCard(span.name, mark.getBoundingClientRect(), input);
		},
		// `select` only fires for a selection; a click or an arrow key
		// that collapses it is caught on the way up.
		onSelect: (event) => track(event.currentTarget),
		onKeyUp: (event) => track(event.currentTarget),
		onMouseUp: (event) => track(event.currentTarget),
		onBlur: () => {
			open.current = false;
			actions.closeSuggest(owner);
			actions.unselect(owner);
		},
	};

	return {
		classify: assist.data.classify,
		handlers,
		attributes: comboboxAttributes(aria),
		changed: (input) => offer(input, true),
	};
}
