/**
 * Drag and drop of the collections tree on @dnd-kit: pointer (after a
 * 6px move, so clicks stay clicks) and keyboard (Space picks up, arrows
 * move, Space or Enter drops, Escape cancels). The drop position comes
 * from the centre of the dragged row over the target row, which works the
 * same for both sensors.
 */
import {
	type DragEndEvent,
	type DragMoveEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	type UniqueIdentifier,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useState } from "react";
import {
	type DropPosition,
	type DropTarget,
	dropPositionAt,
	planMove,
} from "./tree-drop";
import type { TreeRow } from "./tree-rows";
import type { DetailState } from "./use-collections";
import type { MoveInput } from "./use-node-mutations";

export interface TreeDropMark {
	rowId: string;
	position: DropPosition;
}

function targetOf(row: TreeRow): DropTarget {
	return row.kind === "collection"
		? { kind: "collection" }
		: {
				kind: "node",
				nodeId: row.id,
				expanded: row.kind === "folder" && row.expanded,
			};
}

export interface TreeDndOptions {
	rows: readonly TreeRow[];
	details: ReadonlyMap<string, DetailState>;
	onMove: (input: MoveInput) => void;
}

export function useTreeDnd({ rows, details, onMove }: TreeDndOptions) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			keyboardCodes: {
				start: ["Space"],
				cancel: ["Escape"],
				end: ["Space", "Enter"],
			},
		}),
	);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [mark, setMark] = useState<TreeDropMark | null>(null);
	const rowById = (id: UniqueIdentifier | null | undefined) =>
		id === null || id === undefined
			? undefined
			: rows.find((row) => row.id === String(id));

	/** The move of dropping `dragged` on `over` at `position`, when allowed. */
	const plan = (dragged: TreeRow, over: TreeRow, position: DropPosition) => {
		if (dragged.kind === "collection") return null;
		if (dragged.collectionId !== over.collectionId) return null;
		const state = details.get(dragged.collectionId);
		if (state?.status !== "ready") return null;
		const move = planMove(
			state.detail.nodes,
			dragged.id,
			targetOf(over),
			position,
		);
		return move
			? { collectionId: dragged.collectionId, nodeId: dragged.id, move }
			: null;
	};

	/** Drops `draggedId` on `overId` (also the keyboard and test entry point). */
	const drop = (draggedId: string, overId: string, position: DropPosition) => {
		const dragged = rowById(draggedId);
		const over = rowById(overId);
		const input = dragged && over ? plan(dragged, over, position) : null;
		if (input) onMove(input);
		return input !== null;
	};

	const locate = (event: DragMoveEvent): void => {
		const dragged = rowById(event.active.id);
		const over = rowById(event.over?.id);
		if (!dragged || !over || !event.over) {
			setMark(null);
			return;
		}
		const box = event.active.rect.current.translated;
		const y = box ? box.top + box.height / 2 : event.over.rect.top;
		const position = dropPositionAt(over.kind, y, event.over.rect);
		const allowed = plan(dragged, over, position) !== null;
		setMark(allowed ? { rowId: over.id, position } : null);
	};

	const reset = (): void => {
		setActiveId(null);
		setMark(null);
	};

	return {
		sensors,
		activeId,
		mark,
		drop,
		onDragStart: (event: DragStartEvent) =>
			setActiveId(String(event.active.id)),
		onDragMove: locate,
		onDragOver: locate,
		onDragEnd: (event: DragEndEvent) => {
			if (mark) drop(String(event.active.id), mark.rowId, mark.position);
			reset();
		},
		onDragCancel: reset,
	};
}
