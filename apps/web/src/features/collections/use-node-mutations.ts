/**
 * Writes on the folders and requests of a collection. Rename and move
 * change the cached collection at once and roll back with a toast when
 * the API refuses; create, duplicate and delete wait for the API.
 */
import type { CollectionDetail } from "@localman/shared/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../components/ui/toast";
import { useT } from "../../i18n/i18n-context";
import { collectionErrorMessage } from "./collection-errors";
import {
	type NodeCreate,
	type NodeMove,
	createNode,
	deleteNode,
	duplicateNode,
	moveNode,
	updateNode,
} from "./nodes-api";
import { applyMove, subtreeIds } from "./tree-drop";
import { COLLECTIONS_KEY, collectionKey } from "./use-collections";

const LISTS_KEY = [...COLLECTIONS_KEY, "list"] as const;
/** Optimistic writes to cached collections, counted before a refetch. */
const DETAIL_WRITES = ["optimistic", ...COLLECTIONS_KEY, "detail"];

function useEditDetail() {
	const client = useQueryClient();
	return (
		collectionId: string,
		edit: (detail: CollectionDetail) => CollectionDetail,
	): void => {
		client.setQueryData<CollectionDetail>(collectionKey(collectionId), (old) =>
			old ? edit(old) : old,
		);
	};
}

export function useCreateNode() {
	const client = useQueryClient();
	const editDetail = useEditDetail();
	return useMutation({
		mutationFn: ({ collectionId, node }: CreateInput) =>
			createNode(collectionId, node),
		onSuccess: (node, { collectionId }) => {
			editDetail(collectionId, (d) => ({ ...d, nodes: [...d.nodes, node] }));
			// Order keys come from the API: refetch so the new node sits right.
			void client.invalidateQueries({ queryKey: collectionKey(collectionId) });
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

interface CreateInput {
	collectionId: string;
	node: NodeCreate;
}

/** Optimistic edit of one cached collection. */
function useOptimisticDetail<V extends { collectionId: string }>(
	mutationFn: (variables: V) => Promise<unknown>,
	apply: (detail: CollectionDetail, variables: V) => CollectionDetail,
) {
	const client = useQueryClient();
	const toast = useToast();
	const t = useT();
	return useMutation({
		mutationKey: DETAIL_WRITES,
		mutationFn,
		onMutate: async (variables: V) => {
			const queryKey = collectionKey(variables.collectionId);
			await client.cancelQueries({ queryKey });
			const previous = client.getQueryData<CollectionDetail>(queryKey);
			if (previous) client.setQueryData(queryKey, apply(previous, variables));
			return { previous };
		},
		onError: (error, variables, snapshot) => {
			if (snapshot?.previous) {
				client.setQueryData(
					collectionKey(variables.collectionId),
					snapshot.previous,
				);
			}
			toast.show({ tone: "error", title: collectionErrorMessage(error, t) });
		},
		onSettled: (_data, _error, variables) => {
			// A refetch now would undo another edit still on its way.
			if (client.isMutating({ mutationKey: DETAIL_WRITES }) > 1) return;
			void client.invalidateQueries({
				queryKey: collectionKey(variables.collectionId),
			});
		},
	});
}

export function useRenameNode() {
	return useOptimisticDetail(
		({ collectionId, nodeId, name }: RenameInput) =>
			updateNode(collectionId, nodeId, { name }),
		(detail, { nodeId, name }) => ({
			...detail,
			nodes: detail.nodes.map((n) => (n.id === nodeId ? { ...n, name } : n)),
		}),
	);
}

interface RenameInput {
	collectionId: string;
	nodeId: string;
	name: string;
}

export function useMoveNode() {
	return useOptimisticDetail(
		({ collectionId, nodeId, move }: MoveInput) =>
			moveNode(collectionId, nodeId, move),
		(detail, { nodeId, move }) => ({
			...detail,
			nodes: applyMove(detail.nodes, nodeId, move),
		}),
	);
}

export interface MoveInput {
	collectionId: string;
	nodeId: string;
	move: NodeMove;
}

export function useDeleteNode() {
	const client = useQueryClient();
	const editDetail = useEditDetail();
	return useMutation({
		mutationFn: ({ collectionId, nodeId }: DeleteInput) =>
			deleteNode(collectionId, nodeId),
		onSuccess: (_data, { collectionId, nodeId }) => {
			editDetail(collectionId, (detail) => {
				const gone = subtreeIds(detail.nodes, nodeId);
				return {
					...detail,
					nodes: detail.nodes.filter((node) => !gone.has(node.id)),
				};
			});
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

interface DeleteInput {
	collectionId: string;
	nodeId: string;
}

export function useDuplicateNode() {
	const client = useQueryClient();
	const editDetail = useEditDetail();
	return useMutation({
		mutationFn: ({ collectionId, nodeId }: DuplicateInput) =>
			duplicateNode(collectionId, nodeId),
		onSuccess: (nodes, { collectionId }) => {
			editDetail(collectionId, (d) => ({
				...d,
				nodes: [...d.nodes, ...nodes],
			}));
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

interface DuplicateInput {
	collectionId: string;
	nodeId: string;
}
