/**
 * What a copied or notified element link hands to `/api-client` through
 * the router's navigation state: the element's type and id (and a folder,
 * request or example of a collection) only. The workbench reads it once,
 * replaces the entry's state with `null`, and opens the page or tab itself.
 */
import type { ShareableElementType } from "@localman/shared/access";
import { isRecord } from "../../lib/json-guards";
import { elementPath, isElementType } from "./sharing-api";

export interface OpenElement {
	type: ShareableElementType;
	id: string;
	/** A folder, request or example of the collection. */
	nodeId?: string;
	/** A comment on the collection or on `nodeId`, to bring into view. */
	commentId?: string;
}

export const OPEN_ELEMENT_STATE_KEY = "openElement";
/** Query parameter of a link to one node of a collection. */
export const NODE_PARAM = "node";

/** Element and node ids are Mongo ObjectIds, kept loose but bounded. */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const isElementId = (value: unknown): value is string =>
	typeof value === "string" && ID_PATTERN.test(value);

/** Path of a link to a folder, request or example of a collection. */
export const collectionNodePath = (collectionId: string, nodeId: string) =>
	`${elementPath("collection", collectionId)}?${NODE_PARAM}=${encodeURIComponent(nodeId)}`;

export function openElementState(target: OpenElement): {
	[OPEN_ELEMENT_STATE_KEY]: OpenElement;
} {
	const { type, id, nodeId, commentId } = target;
	const node = type === "collection" && nodeId !== undefined ? { nodeId } : {};
	const comment =
		type === "collection" && commentId !== undefined ? { commentId } : {};
	return { [OPEN_ELEMENT_STATE_KEY]: { type, id, ...node, ...comment } };
}

/** The element in `location.state`, or `null` when absent or malformed. */
export function readOpenElement(state: unknown): OpenElement | null {
	if (!isRecord(state)) return null;
	const target = state[OPEN_ELEMENT_STATE_KEY];
	if (!isRecord(target)) return null;
	const { type, id, nodeId, commentId } = target;
	if (!isElementType(type) || !isElementId(id)) return null;
	if (type !== "collection") {
		return nodeId === undefined && commentId === undefined
			? { type, id }
			: null;
	}
	if (nodeId !== undefined && !isElementId(nodeId)) return null;
	if (commentId !== undefined && !isElementId(commentId)) return null;
	return {
		type,
		id,
		...(nodeId === undefined ? {} : { nodeId }),
		...(commentId === undefined ? {} : { commentId }),
	};
}
