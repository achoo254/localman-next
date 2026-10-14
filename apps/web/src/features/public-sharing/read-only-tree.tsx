import type {
	ImportedItem,
	ImportedRequest,
} from "@localman/shared/api-client";
import {
	type KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { cn } from "../../lib/cn";
import {
	RowLead,
	type TreeRow,
	isFolder,
	visibleRows,
} from "./read-only-tree-rows";

export interface ReadOnlyTreeProps {
	items: readonly ImportedItem[];
	/** Accessible name of the tree. */
	label: string;
	selectedId: string | null;
	onSelect: (request: ImportedRequest) => void;
}

/**
 * Folders and requests of a published collection, read-only (WAI-ARIA
 * tree, one tab stop): ↑/↓, Home/End, → opens a folder or goes to its
 * first child, ← closes it or goes to the parent, Enter or Space opens a
 * folder or shows a request. Top-level folders start open.
 */
export function ReadOnlyTree({
	items,
	label,
	selectedId,
	onSelect,
}: ReadOnlyTreeProps) {
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(
		() => new Set(items.filter(isFolder).map((folder) => folder.id)),
	);
	const [focusId, setFocusId] = useState<string | null>(null);
	const rows = useMemo(() => visibleRows(items, expanded), [items, expanded]);
	const elements = useRef(new Map<string, HTMLLIElement>());
	const moved = useRef(false);
	const active =
		rows.find((row) => row.item.id === focusId) ??
		rows.find((row) => row.item.id === selectedId) ??
		rows[0];

	useEffect(() => {
		if (!moved.current || !focusId) return;
		moved.current = false;
		elements.current.get(focusId)?.focus();
	}, [focusId]);

	const toggle = (id: string, open: boolean) =>
		setExpanded((current) => {
			const next = new Set(current);
			if (open) next.add(id);
			else next.delete(id);
			return next;
		});
	const go = (row: TreeRow | undefined) => {
		if (!row) return;
		moved.current = true;
		setFocusId(row.item.id);
	};
	const activate = (row: TreeRow) => {
		setFocusId(row.item.id);
		if (isFolder(row.item)) toggle(row.item.id, !expanded.has(row.item.id));
		else onSelect(row.item);
	};

	function onKeyDown(event: KeyboardEvent<HTMLLIElement>, row: TreeRow) {
		const index = rows.indexOf(row);
		const open = isFolder(row.item) && expanded.has(row.item.id);
		switch (event.key) {
			case "ArrowDown":
				go(rows[index + 1]);
				break;
			case "ArrowUp":
				go(rows[index - 1]);
				break;
			case "Home":
				go(rows[0]);
				break;
			case "End":
				go(rows[rows.length - 1]);
				break;
			case "ArrowRight":
				if (isFolder(row.item) && !open) toggle(row.item.id, true);
				else if (open) go(rows[index + 1]);
				break;
			case "ArrowLeft":
				if (open) toggle(row.item.id, false);
				else go(rows.find((r) => r.item.id === row.parentId));
				break;
			case "Enter":
			case " ":
				activate(row);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	return (
		<ul
			role="tree"
			aria-label={label}
			data-id="public-tree"
			className="m-0 grid list-none gap-0.5 p-0"
		>
			{rows.map((row) => {
				const { item } = row;
				const folder = isFolder(item);
				const selected = !folder && item.id === selectedId;
				return (
					<li
						key={item.id}
						ref={(element) => {
							if (element) elements.current.set(item.id, element);
							else elements.current.delete(item.id);
						}}
						role="treeitem"
						aria-level={row.depth}
						aria-posinset={row.position}
						aria-setsize={row.siblings}
						aria-expanded={folder ? expanded.has(item.id) : undefined}
						aria-selected={folder ? undefined : selected}
						tabIndex={row === active ? 0 : -1}
						data-id="public-tree-item"
						title={item.name}
						onClick={() => activate(row)}
						onKeyDown={(event) => onKeyDown(event, row)}
						style={{
							paddingInlineStart: `calc(var(--spacing) * ${(row.depth - 1) * 4})`,
						}}
						className={cn(
							"flex min-h-8 cursor-pointer items-center gap-1.5 rounded-sm pr-2 text-sm outline-none hover:bg-fg/6 focus-visible:shadow-focus-primary pointer-coarse:min-h-11",
							selected && "bg-primary/10 text-primary",
						)}
					>
						<RowLead item={item} open={expanded.has(item.id)} />
						<span className="min-w-0 truncate">{item.name}</span>
					</li>
				);
			})}
		</ul>
	);
}
