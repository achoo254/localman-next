import { useState } from "react";
import {
	canConnect,
	connectProblem,
	connectProblemMessage,
} from "./can-connect";
import type { TreeItem } from "./tree-layout";

export type ConnectorState = "idle" | "target" | "invalid";

export interface TreeConnect<T extends TreeItem> {
	/** Resource picked with its left connector, if any. */
	selected: T | null;
	/** Left connector: select a node, or drop the selection when it is this node. */
	toggle: (id: string) => void;
	clear: () => void;
	/** How a node's right connector looks while something is selected. */
	targetState: (id: string) => ConnectorState;
	/** The rail is a valid target (the selection is nested). */
	rootActive: boolean;
	/** Right connector (`id`) or rail (`null`): nest the selection there. */
	connect: (targetId: string | null) => void;
}

export interface TreeConnectHandlers<T> {
	onMove: (moving: T, target: T | null) => void;
	/** The move is refused before any request; `info` when nothing is wrong. */
	onRefuse: (message: string, tone: "info" | "error") => void;
}

/**
 * Nesting by connectors, as in the source: click a node's left connector
 * to select it, then the right connector of another node (or the root
 * rail). `canConnect` refuses the node itself, its current parent, its own
 * descendants (cycle), a sibling name clash and too deep a tree.
 */
export function useTreeConnect<T extends TreeItem>(
	items: readonly T[],
	{ onMove, onRefuse }: TreeConnectHandlers<T>,
): TreeConnect<T> {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	// A selection whose resource disappeared (deleted, reloaded) is dropped.
	const selected = items.find((item) => item.id === selectedId) ?? null;

	const targetState = (id: string): ConnectorState => {
		if (!selected) return "idle";
		return canConnect(items, selected.id, id) ? "target" : "invalid";
	};

	function connect(targetId: string | null) {
		if (!selected) {
			onRefuse(
				"Chọn một resource trước: bấm chấm tròn bên trái resource đó.",
				"info",
			);
			return;
		}
		const problem = connectProblem(items, selected.id, targetId);
		if (problem === "self") {
			setSelectedId(null);
			return;
		}
		const target =
			targetId === null
				? null
				: (items.find((item) => item.id === targetId) ?? null);
		if (problem) {
			onRefuse(
				connectProblemMessage(problem, selected.name, target?.name ?? null),
				problem === "already-there" ? "info" : "error",
			);
			return;
		}
		setSelectedId(null);
		onMove(selected, target);
	}

	return {
		selected,
		toggle: (id) => setSelectedId((current) => (current === id ? null : id)),
		clear: () => setSelectedId(null),
		targetState,
		rootActive: selected !== null && canConnect(items, selected.id, null),
		connect,
	};
}
