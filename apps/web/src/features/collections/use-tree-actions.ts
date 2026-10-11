/**
 * What the tree's menus, star, rename box and drops do: API writes with
 * toasts, and the dialogs to open.
 */
import {
	type CollectionDetail,
	createRequestDraft,
} from "@localman/shared/api-client";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { copyText } from "../../platform/clipboard";
import { appPageUrl } from "../../platform/navigation";
import { elementPath } from "../sharing/sharing-api";
import type { TreeDialog } from "./collection-dialogs";
import { collectionErrorMessage } from "./collection-errors";
import { subtreeIds } from "./tree-drop";
import type { TreeAction } from "./tree-row-menu";
import type { TreeRow } from "./tree-rows";
import {
	useDuplicateCollection,
	useFavoriteCollection,
	useRenameCollection,
} from "./use-collection-mutations";
import type { DetailState } from "./use-collections";
import { useExportCollection } from "./use-export-collection";
import {
	useCreateNode,
	useDuplicateNode,
	useMoveNode,
	useRenameNode,
} from "./use-node-mutations";
import { useRenameSync } from "./use-rename-sync";

export interface TreeActionsOptions {
	workspaceId: string;
	details: ReadonlyMap<string, DetailState>;
	/** Opens a collection or folder (a new child shows inside). */
	expand: (id: string) => void;
	startRename: (id: string | null) => void;
	openDialog: (dialog: TreeDialog) => void;
}

function requestsUnder(detail: CollectionDetail, nodeId: string): number {
	const ids = subtreeIds(detail.nodes, nodeId);
	return detail.nodes.filter((n) => n.kind === "request" && ids.has(n.id))
		.length;
}

export function useTreeActions(options: TreeActionsOptions) {
	const { workspaceId, details, expand, startRename, openDialog } = options;
	const t = useT();
	const toast = useToast();
	const fail = (error: unknown) =>
		toast.show({ tone: "error", title: collectionErrorMessage(error, t) });
	const createNode = useCreateNode();
	const renameCollection = useRenameCollection(workspaceId);
	const renameNode = useRenameNode();
	const favorite = useFavoriteCollection(workspaceId);
	const duplicateCollection = useDuplicateCollection();
	const duplicateNode = useDuplicateNode();
	const moveNode = useMoveNode();
	const exportCollection = useExportCollection();
	const syncRename = useRenameSync();
	const detailOf = (collectionId: string): CollectionDetail | null => {
		const state = details.get(collectionId);
		return state?.status === "ready" ? state.detail : null;
	};
	const duplicated = (name: string) =>
		toast.show({
			tone: "success",
			title: t("collections.toast.duplicated", { name }),
		});

	const add = (row: TreeRow, kind: "folder" | "request"): void => {
		const parentId = row.kind === "collection" ? null : row.id;
		const name = t(
			kind === "folder"
				? "collections.defaults.folder"
				: "collections.defaults.request",
		);
		createNode.mutate(
			{
				collectionId: row.collectionId,
				node:
					kind === "folder"
						? { kind, parentId, name }
						: { kind, parentId, name, draft: createRequestDraft({ name }) },
			},
			{
				onSuccess: (node) => {
					expand(row.id);
					startRename(node.id);
				},
				onError: fail,
			},
		);
	};

	const copyLink = async (row: TreeRow): Promise<void> => {
		const copied = await copyText(
			appPageUrl(elementPath("collection", row.id)),
		);
		toast.show(
			copied
				? { tone: "success", title: t("collections.toast.linkCopied") }
				: { tone: "error", title: t("collections.toast.linkFailed") },
		);
	};

	const onAction = (action: TreeAction, row: TreeRow): void => {
		const summary = row.kind === "collection" ? row.summary : null;
		if (action === "addRequest" || action === "addFolder") {
			add(row, action === "addFolder" ? "folder" : "request");
		} else if (action === "rename") startRename(row.id);
		else if (action === "copyLink") void copyLink(row);
		else if (action === "export") void exportCollection(row.id, row.name);
		else if (summary && (action === "share" || action === "move")) {
			openDialog({ kind: action, summary });
		} else if (summary && action === "delete") {
			openDialog({ kind: "deleteCollection", summary });
		} else if (summary && action === "duplicate") {
			duplicateCollection.mutate(row.id, {
				onSuccess: (copy) => duplicated(copy.name),
				onError: fail,
			});
		} else if (row.kind !== "collection") {
			const detail = detailOf(row.collectionId);
			if (!detail) return;
			if (action === "delete") {
				const requestCount = requestsUnder(detail, row.id);
				openDialog({
					kind: "deleteNode",
					collectionId: detail.id,
					node: row.node,
					requestCount,
				});
			} else if (action === "duplicate") {
				duplicateNode.mutate(
					{ collectionId: detail.id, nodeId: row.id },
					{
						onSuccess: ([copy]) => {
							if (copy) duplicated(copy.name);
						},
						onError: fail,
					},
				);
			}
		}
	};

	const onRenameDone = (row: TreeRow, name: string | null): void => {
		if (name === null) return;
		const onSuccess = () => syncRename(row, name);
		if (row.kind === "collection") {
			renameCollection.mutate({ id: row.id, name }, { onSuccess });
			return;
		}
		const nodeId = row.id;
		renameNode.mutate(
			{ collectionId: row.collectionId, nodeId, name },
			{ onSuccess },
		);
	};

	const onFavorite = (row: TreeRow): void => {
		if (row.kind !== "collection") return;
		const next = !row.summary.favorite;
		favorite.mutate(
			{ id: row.id, favorite: next },
			{
				onSuccess: () => {
					if (!next) return;
					toast.show({
						tone: "info",
						title: t("collections.toast.favorited", { name: row.name }),
					});
				},
			},
		);
	};

	return { onAction, onRenameDone, onFavorite, onMove: moveNode.mutate };
}
