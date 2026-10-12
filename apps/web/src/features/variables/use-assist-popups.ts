/**
 * State of the assist's popups (hover card, `{{` suggestions, the
 * "Set as variable" button and modal) and the stable actions editors call.
 * Editors call often (every pointer move, every keystroke), so repeated
 * calls with the same content leave the state as it is.
 */
import type { ResolverLayer } from "@localman/shared/api-client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
	type AnchorRect,
	type SuggestRequest,
	type VariableAssistActions,
	suggestOptionId,
} from "./variable-assist-context";
import { type VariableSuggestion, suggestionsFor } from "./variable-kinds";

export interface CardState {
	name: string;
	rect: DOMRect;
	/** Opened from the keyboard: focus goes in, Escape returns it here. */
	returnTo: HTMLElement | null;
}

export interface SuggestState extends SuggestRequest {
	active: number;
}

export interface SelectionState {
	owner: object;
	text: string;
	anchor: AnchorRect;
}

const HIDE_DELAY_MS = 200;

const sameRect = (a: DOMRect, b: DOMRect): boolean =>
	a.left === b.left && a.top === b.top && a.width === b.width;

export function useAssistPopups(layers: readonly ResolverLayer[]) {
	const [card, setCard] = useState<CardState | null>(null);
	const [suggest, setSuggest] = useState<SuggestState | null>(null);
	const [selection, setSelection] = useState<SelectionState | null>(null);
	const [modalValue, setModalValue] = useState<string | null>(null);
	const items = useMemo<VariableSuggestion[]>(
		() => (suggest ? suggestionsFor(layers, suggest.query) : []),
		[layers, suggest],
	);
	const latest = useRef({ card, suggest, selection, items });
	latest.current = { card, suggest, selection, items };
	const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const listId = useId();

	// The editor showing the list is told its ARIA state; the one whose
	// list closed (or moved to another editor) is told it is gone.
	const ariaOwner = useRef<SuggestRequest | null>(null);
	useEffect(() => {
		const open = suggest && items.length > 0 ? suggest : null;
		const previous = ariaOwner.current;
		if (previous && previous.owner !== open?.owner) previous.onAria?.(null);
		ariaOwner.current = open;
		open?.onAria?.({ listId, activeId: suggestOptionId(listId, open.active) });
	}, [suggest, items, listId]);

	// Only refs and state setters inside: the first closure stays valid.
	const pick = useRef((name: string) => {
		const current = latest.current.suggest;
		setSuggest(null);
		current?.pick(name);
	}).current;

	const stopHide = () => {
		if (hideTimer.current !== null) clearTimeout(hideTimer.current);
		hideTimer.current = null;
	};
	useEffect(
		() => () => {
			if (hideTimer.current !== null) clearTimeout(hideTimer.current);
		},
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: built once; it reads state through `latest`.
	const actions = useMemo<VariableAssistActions>(() => {
		return {
			hover: (name, rect) => {
				stopHide();
				const current = latest.current.card;
				if (current?.returnTo) return;
				if (current?.name === name && sameRect(current.rect, rect)) return;
				setCard({ name, rect, returnTo: null });
			},
			unhover: () => {
				if (latest.current.card?.returnTo || hideTimer.current !== null) {
					return;
				}
				hideTimer.current = setTimeout(() => {
					hideTimer.current = null;
					setCard(null);
				}, HIDE_DELAY_MS);
			},
			focusCard: (name, rect, returnTo) => {
				stopHide();
				setSuggest(null);
				setCard({ name, rect, returnTo });
			},
			suggest: (request) => {
				setSuggest((current) =>
					current?.owner === request.owner && current.query === request.query
						? { ...request, active: current.active }
						: { ...request, active: 0 },
				);
			},
			closeSuggest: (owner) =>
				setSuggest((current) => (current?.owner === owner ? null : current)),
			suggestKey: (key, modified = false) => {
				const { suggest: open, items: list } = latest.current;
				if (!open || list.length === 0 || modified) return false;
				const step = (delta: number) =>
					setSuggest((current) =>
						current
							? {
									...current,
									active: (current.active + delta + list.length) % list.length,
								}
							: current,
					);
				if (key === "ArrowDown") step(1);
				else if (key === "ArrowUp") step(-1);
				else if (key === "Escape") setSuggest(null);
				else if (key === "Enter" || key === "Tab") {
					const item = list[open.active] ?? list[0];
					if (item) pick(item.name);
				} else return false;
				return true;
			},
			select: (owner, text, anchor) => {
				const current = latest.current.selection;
				if (current?.owner === owner && current.text === text) return;
				setSelection(text.trim() ? { owner, text, anchor } : null);
			},
			unselect: (owner) =>
				setSelection((current) => (current?.owner === owner ? null : current)),
			setAsVariable: (value) => {
				stopHide();
				setCard(null);
				setSuggest(null);
				setSelection(null);
				setModalValue(value);
			},
		};
	}, []);

	const hoverAt = (index: number) =>
		setSuggest((current) =>
			current && current.active !== index
				? { ...current, active: index }
				: current,
		);

	return {
		actions,
		card,
		closeCard: () => {
			stopHide();
			setCard(null);
		},
		keepCard: stopHide,
		suggest: suggest && items.length > 0 ? { ...suggest, items, listId } : null,
		pick,
		hoverAt,
		selection,
		modalValue,
		closeModal: () => setModalValue(null),
	};
}
