import type { Announcements, ScreenReaderInstructions } from "@dnd-kit/core";
import type { Translate } from "../../i18n/translate";
import type { TreeRow } from "./tree-rows";

function nameOf(rows: readonly TreeRow[], id: string | number): string {
	return rows.find((row) => row.id === String(id))?.name ?? "";
}

/** What screen readers hear while a tree row is dragged. */
export function treeDndAccessibility(
	rows: readonly TreeRow[],
	t: Translate,
): {
	screenReaderInstructions: ScreenReaderInstructions;
	announcements: Announcements;
} {
	return {
		screenReaderInstructions: { draggable: t("collections.dnd.instructions") },
		announcements: {
			onDragStart: ({ active }) =>
				t("collections.dnd.picked", { name: nameOf(rows, active.id) }),
			onDragOver: ({ over }) =>
				over
					? t("collections.dnd.over", { target: nameOf(rows, over.id) })
					: undefined,
			onDragMove: () => undefined,
			onDragEnd: ({ active }) =>
				t("collections.dnd.dropped", { name: nameOf(rows, active.id) }),
			onDragCancel: ({ active }) =>
				t("collections.dnd.cancelled", { name: nameOf(rows, active.id) }),
		},
	};
}
