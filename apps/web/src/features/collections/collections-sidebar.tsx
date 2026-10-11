import { memo, useId, useMemo, useRef, useState } from "react";
import { PanelProgress } from "../../components/ui/panel-progress";
import { useDebouncedValue } from "../../lib/use-debounced-value";
import { useCurrentWorkspace } from "../workspaces/current-workspace";
import { CollectionDialogs } from "./collection-dialogs";
import { CollectionSearchBar } from "./collection-search-bar";
import { CollectionSearchResults } from "./collection-search-results";
import { CollectionsBody } from "./collections-body";
import { CollectionsHead } from "./collections-head";
import type { OpenNode } from "./open-node";
import { type TreeRow, buildTreeRows, sortCollections } from "./tree-rows";
import { useCollectionCreate } from "./use-collection-create";
import { SEARCH_DEBOUNCE_MS } from "./use-collection-search";
import { useCollectionSort } from "./use-collection-sort";
import { useCollectionDetails, useCollectionList } from "./use-collections";
import { useTreeActions } from "./use-tree-actions";
import { useTreeDnd } from "./use-tree-dnd";
import { useTreePermissions } from "./use-tree-permissions";
import { useTreeState } from "./use-tree-state";

export interface CollectionsSidebarProps {
	/** Opens a request, folder or collection (round 2 wires tabs to it). */
	onOpenNode: OpenNode;
	/** Opens the import dialog on "Save as collection". */
	onImport: () => void;
}

/** Collections of the current workspace as a tree (workspaces flag on). */
export const CollectionsSidebar = memo(function CollectionsSidebar({
	onOpenNode,
	onImport,
}: CollectionsSidebarProps) {
	const titleId = useId();
	const searchRef = useRef<HTMLInputElement>(null);
	const sectionRef = useRef<HTMLElement>(null);
	const { query: workspacesQuery, current } = useCurrentWorkspace();
	const workspaceId = current?.id ?? null;
	const list = useCollectionList(workspaceId);
	const [query, setQuery] = useState("");
	const [sort, setSort] = useCollectionSort();
	const state = useTreeState();
	const { canAdd, permissionsOf } = useTreePermissions(
		current?.role ?? null,
		list.data,
	);
	const searching = query.trim() !== "";
	const settledQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);

	const sorted = useMemo(
		() => sortCollections(list.data ?? [], sort),
		[list.data, sort],
	);
	const detailIds = useMemo(
		() =>
			sorted
				.filter((item) => state.expanded.has(item.id))
				.map((item) => item.id),
		[sorted, state.expanded],
	);
	const details = useCollectionDetails(detailIds);
	const rows = useMemo(
		() =>
			buildTreeRows({
				collections: sorted,
				details,
				expanded: state.expanded,
			}),
		[sorted, details, state.expanded],
	);

	const creator = useCollectionCreate(workspaceId ?? "", (detail, rename) => {
		state.setFocusId(detail.id);
		if (rename) state.setRenamingId(detail.id);
	});
	const actions = useTreeActions({
		workspaceId: workspaceId ?? "",
		details,
		expand: (id) => state.setOpen(id, true),
		startRename: state.setRenamingId,
		openDialog: state.openDialog,
	});
	const dnd = useTreeDnd({ rows, details, onMove: actions.onMove });

	const activate = (row: TreeRow): void => {
		state.focusRow(row.id);
		if (row.kind === "request") {
			const item = details.get(row.collectionId);
			if (item?.status === "ready") {
				onOpenNode({
					kind: "request",
					collection: item.detail,
					node: row.node,
				});
			}
			return;
		}
		state.setOpen(row.id, !row.expanded);
		onOpenNode(
			row.kind === "collection"
				? { kind: "collection", collectionId: row.id, name: row.name }
				: {
						kind: "folder",
						collectionId: row.collectionId,
						nodeId: row.id,
						name: row.name,
					},
		);
	};

	const dialogRowId = (): string | null => {
		const value = state.dialog?.value;
		if (!value) return null;
		return value.kind === "deleteNode" ? value.node.id : value.summary.id;
	};
	const focusAfterRemoval = (event: Event): void => {
		const id = dialogRowId();
		if (id !== null && state.isRowShown(id)) return;
		event.preventDefault();
		const stop = sectionRef.current?.querySelector<HTMLElement>(
			'[role="treeitem"][tabindex="0"]',
		);
		(stop ?? searchRef.current)?.focus();
	};

	return (
		<section
			ref={sectionRef}
			data-id="sidebar-collections"
			aria-labelledby={titleId}
			className="flex min-h-0 flex-col"
		>
			<CollectionsHead
				titleId={titleId}
				creator={creator}
				canAdd={canAdd}
				onImport={onImport}
			/>
			<CollectionSearchBar
				query={query}
				onQueryChange={setQuery}
				sort={sort}
				onSortChange={setSort}
				inputRef={searchRef}
			/>
			<PanelProgress
				active={list.isFetching && !list.isPending}
				className="min-h-0 flex-1 overflow-y-auto"
			>
				{searching ? (
					<CollectionSearchResults
						workspaceId={workspaceId}
						query={settledQuery}
						onOpen={onOpenNode}
					/>
				) : (
					<CollectionsBody
						workspacesQuery={workspacesQuery}
						list={list}
						canAdd={canAdd}
						creating={creator.pending}
						onNew={() => void creator.blank()}
						onImport={onImport}
						tree={{
							rows,
							details,
							labelledBy: titleId,
							focusId: state.focusId,
							renamingId: state.renamingId,
							permissionsOf,
							dnd,
							onFocusRow: state.focusRow,
							onActivate: activate,
							onExpand: (row, open) => state.setOpen(row.id, open),
							onStartRename: (row) => state.setRenamingId(row.id),
							onFavorite: actions.onFavorite,
							onAction: actions.onAction,
							onRenameDone: (row, name, byKey) => {
								state.setRenamingId(null);
								if (byKey) state.focusRow(row.id);
								actions.onRenameDone(row, name);
							},
							registerRef: state.registerRef,
						}}
					/>
				)}
			</PanelProgress>
			<CollectionDialogs
				key={state.dialog?.seq ?? 0}
				dialog={state.dialog?.value ?? null}
				open={state.dialog?.open ?? false}
				onClose={state.closeDialog}
				onFocusAfterRemoval={focusAfterRemoval}
			/>
		</section>
	);
});
