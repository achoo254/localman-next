/**
 * The editable fields of a collection or folder page, as stored with the
 * edits not saved yet on top, and the autosave writing them back
 * (`PATCH /collections/:id` or `PATCH …/nodes/:id`).
 */
import type {
	CollectionDetail,
	CollectionFolderNode,
	EffectiveAuth,
	RequestAuth,
	RequestScripts,
	VariableEntry,
} from "@localman/shared/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useContext, useEffect } from "react";
import { useWorkbenchActions } from "../api-client/workbench/workbench-context";
import type { PageTab } from "../api-client/workbench/workbench-tab-types";
import {
	type CollectionPatch,
	updateCollection,
	updateNode,
} from "./collections-api";
import { PageSaveContext } from "./page-save-context";
import {
	COLLECTIONS_KEY,
	collectionKey,
	useCollection,
} from "./use-collections";
import { usePageAutosave } from "./use-page-autosave";
import { withNode } from "./use-request-save";

export interface PageFields {
	name: string;
	description: string;
	auth: RequestAuth;
	scripts: RequestScripts;
	/** Collections only; a folder keeps none. */
	variables: VariableEntry[];
}

function isEffective(auth: RequestAuth): auth is EffectiveAuth {
	return auth.type !== "inherit";
}

function collectionPatch(patch: Partial<PageFields>): CollectionPatch {
	const { auth, ...rest } = patch;
	return auth && isEffective(auth) ? { ...rest, auth } : rest;
}

function storedFields(
	detail: CollectionDetail,
	folder: CollectionFolderNode | undefined,
): PageFields {
	if (folder) {
		const { name, description, auth, scripts } = folder;
		return { name, description, auth, scripts, variables: [] };
	}
	const { name, description, auth, scripts, variables } = detail;
	return { name, description, auth, scripts, variables };
}

export function usePageModel(page: PageTab) {
	const client = useQueryClient();
	const { renamePage } = useWorkbenchActions();
	const register = useContext(PageSaveContext);
	const query = useCollection(page.collectionId);
	const detail = query.data;
	const folder = detail?.nodes.find(
		(node): node is CollectionFolderNode =>
			node.kind === "folder" && node.id === page.nodeId,
	);
	const missing = page.kind === "folder" && detail !== undefined && !folder;

	const save = async (patch: Partial<PageFields>): Promise<void> => {
		const key = collectionKey(page.collectionId);
		if (page.kind === "collection") {
			const next = await updateCollection(
				page.collectionId,
				collectionPatch(patch),
			);
			client.setQueryData(key, next);
		} else if (page.nodeId) {
			const { variables: _variables, ...fields } = patch;
			const node = await updateNode(page.collectionId, page.nodeId, fields);
			client.setQueryData<CollectionDetail>(key, (d) => withNode(d, node));
		}
		if (patch.name) renamePage(page.id, patch.name);
		void client.invalidateQueries({ queryKey: [...COLLECTIONS_KEY, "list"] });
	};
	const autosave = usePageAutosave<PageFields>(save);
	const { flush } = autosave;

	useEffect(() => {
		if (!register) return;
		register(page.id, () => void flush());
		return () => register(page.id, null);
	}, [register, page.id, flush]);

	const fields =
		detail && !missing
			? { ...storedFields(detail, folder), ...autosave.pending }
			: null;
	return {
		query,
		detail,
		folder,
		missing,
		fields,
		canEdit: detail?.role === "editor",
		edit: autosave.edit,
		flush,
		status: autosave.status,
	};
}
