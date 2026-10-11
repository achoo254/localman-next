/**
 * Local state of the collections tree: expanded rows, the row holding the
 * tab stop, the rename box, the open dialog, and the row elements so focus
 * can move by keyboard and come back after a dialog.
 */
import { type RefObject, useCallback, useRef, useState } from "react";
import type { TreeDialog } from "./collection-dialogs";

interface DialogState {
	value: TreeDialog;
	open: boolean;
	/** New per opening, so a dialog never keeps the last one's input. */
	seq: number;
}

export function useTreeState() {
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
	const [focusId, setFocusId] = useState<string | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [dialog, setDialog] = useState<DialogState | null>(null);
	const refs = useRef(new Map<string, HTMLElement>());

	const registerRef = useCallback((id: string, element: HTMLElement | null) => {
		if (element) refs.current.set(id, element);
		else refs.current.delete(id);
	}, []);

	const focusRow = useCallback((id: string) => {
		setFocusId(id);
		refs.current.get(id)?.focus();
	}, []);

	const setOpen = useCallback((id: string, open: boolean) => {
		setExpanded((current) => {
			if (current.has(id) === open) return current;
			const next = new Set(current);
			if (open) next.add(id);
			else next.delete(id);
			return next;
		});
	}, []);

	const openDialog = useCallback((value: TreeDialog) => {
		setDialog((current) => ({
			value,
			open: true,
			seq: (current?.seq ?? 0) + 1,
		}));
	}, []);

	const closeDialog = useCallback(() => {
		setDialog((current) => (current ? { ...current, open: false } : null));
	}, []);

	/** The row a dialog acts on, while it is still in the tree. */
	const isRowShown = useCallback(
		(id: string) => refs.current.get(id)?.isConnected === true,
		[],
	);

	return {
		expanded,
		setOpen,
		focusId,
		setFocusId,
		focusRow,
		renamingId,
		setRenamingId,
		dialog,
		openDialog,
		closeDialog,
		registerRef,
		isRowShown,
	};
}

/**
 * Where focus goes when a dialog closes on a row that is gone (deleted,
 * moved away): the tree's tab stop, else the search box. A row still
 * shown lets the dialog return focus to its own trigger.
 */
export function useFocusAfterRemoval(
	state: ReturnType<typeof useTreeState>,
	section: RefObject<HTMLElement | null>,
	search: RefObject<HTMLInputElement | null>,
) {
	return (event: Event): void => {
		const value = state.dialog?.value;
		const id = value
			? value.kind === "deleteNode"
				? value.node.id
				: value.summary.id
			: null;
		if (id !== null && state.isRowShown(id)) return;
		event.preventDefault();
		const stop = section.current?.querySelector<HTMLElement>(
			'[role="treeitem"][tabindex="0"]',
		);
		(stop ?? search.current)?.focus();
	};
}
