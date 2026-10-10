import {
	type FocusEvent,
	type KeyboardEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import type { LaidOutNode, TreeItem } from "./tree-layout";
import { isTreeNavKey, treeItemMeta, treeNavTarget } from "./tree-navigation";

interface FocusHandlers {
	ref: (element: HTMLElement | null) => void;
	onFocus: () => void;
	onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** Attributes of a node's `role="treeitem"` (an empty box under its card). */
export interface TreeItemProps extends FocusHandlers {
	role: "treeitem";
	"aria-level": number;
	"aria-setsize": number;
	"aria-posinset": number;
	/** Present only on a node with children (every branch stays open). */
	"aria-expanded": true | undefined;
	tabIndex: 0 | -1;
	onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** What a node's card needs from the tree. */
export interface TreeCardBinding {
	/** Spread on the card's root: keeps the node "focused" while a control has focus. */
	cardProps: FocusHandlers;
	/**
	 * `tabIndex` of the card's controls: 0 only while focus is on the node
	 * or one of them, so Tab steps from the tree item into its controls and
	 * the tree stays one tab stop.
	 */
	innerTabIndex: 0 | -1;
	/** Focus is on the node or its controls (shows the action row). */
	focused: boolean;
}

export type TreeNodeBinding = TreeCardBinding & { itemProps: TreeItemProps };

function prefersReducedMotion(): boolean {
	return (
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/**
 * Roving tabindex of the tree canvas: one tree item holds `tabIndex=0`;
 * ↑/↓ walk the nodes in tree order, → goes to the first child, ← to the
 * parent, Home/End to the first/last node, Enter activates the node. The
 * focused node scrolls into view (smoothly unless motion is reduced).
 *
 * The tree items hold no controls: each node's card (with its buttons)
 * is a sibling outside `role="tree"`, which keeps the tree valid for axe
 * (no interactive content in a tree item, its label is all its text).
 */
export function useRovingTree<T extends TreeItem>(
	nodes: readonly LaidOutNode<T>[],
	onActivate?: (item: T) => void,
): (node: LaidOutNode<T>, index: number) => TreeNodeBinding {
	const meta = useMemo(
		() => treeItemMeta(nodes.map((node) => node.depth)),
		[nodes],
	);
	// Tree item and card of each node, by id.
	const items = useRef(new Map<string, HTMLElement>());
	const cards = useRef(new Map<string, HTMLElement>());
	const [activeId, setActiveId] = useState<string | null>(null);
	const [focusedId, setFocusedId] = useState<string | null>(null);
	// A removed active node hands the tab stop to the first node.
	const tabStop = nodes.some((node) => node.item.id === activeId)
		? activeId
		: (nodes[0]?.item.id ?? null);

	function moveTo(index: number) {
		const node = nodes[index];
		if (!node) return;
		setActiveId(node.item.id);
		const element = items.current.get(node.item.id);
		if (!element) return;
		element.focus({ preventScroll: true });
		// jsdom has no scrollIntoView.
		element.scrollIntoView?.({
			block: "nearest",
			inline: "nearest",
			behavior: prefersReducedMotion() ? "auto" : "smooth",
		});
	}

	function focusHandlers(
		id: string,
		store: Map<string, HTMLElement>,
	): FocusHandlers {
		return {
			ref: (element) => {
				if (element) store.set(id, element);
				else store.delete(id);
			},
			onFocus: () => {
				setActiveId(id);
				setFocusedId(id);
			},
			onBlur: (event) => {
				const next = event.relatedTarget;
				const inNode =
					next instanceof Node &&
					[items.current.get(id), cards.current.get(id)].some((part) =>
						part?.contains(next),
					);
				if (!inNode) {
					setFocusedId((current) => (current === id ? null : current));
				}
			},
		};
	}

	return (node, index) => {
		const { id } = node.item;
		const item = meta[index];
		return {
			focused: focusedId === id,
			innerTabIndex: focusedId === id ? 0 : -1,
			cardProps: focusHandlers(id, cards.current),
			itemProps: {
				...focusHandlers(id, items.current),
				role: "treeitem",
				"aria-level": item?.level ?? node.depth + 1,
				"aria-setsize": item?.setSize ?? 1,
				"aria-posinset": item?.posInSet ?? 1,
				"aria-expanded": item?.hasChildren ? true : undefined,
				tabIndex: tabStop === id ? 0 : -1,
				onKeyDown: (event) => {
					if (event.key === "Enter" && onActivate) {
						event.preventDefault();
						onActivate(node.item);
						return;
					}
					if (!isTreeNavKey(event.key)) return;
					event.preventDefault();
					const target = treeNavTarget(meta, index, event.key);
					if (target !== null) moveTo(target);
				},
			},
		};
	};
}
