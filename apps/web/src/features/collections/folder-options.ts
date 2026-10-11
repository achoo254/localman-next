import {
	type CollectionDetail,
	childrenByParent,
} from "@localman/shared/api-client";

export interface FolderOption {
	id: string;
	/** Folder names from the top, e.g. "Users / Admin". */
	path: string;
}

/** Every folder of the collection in tree order, with its path. */
export function folderOptions(detail: CollectionDetail): FolderOption[] {
	const byParent = childrenByParent(detail.nodes);
	const out: FolderOption[] = [];
	const seen = new Set<string>();
	const visit = (parentId: string | null, prefix: string): void => {
		for (const node of byParent.get(parentId) ?? []) {
			if (node.kind !== "folder" || seen.has(node.id)) continue;
			seen.add(node.id);
			const path = prefix ? `${prefix} / ${node.name}` : node.name;
			out.push({ id: node.id, path });
			visit(node.id, path);
		}
	};
	visit(null, "");
	return out;
}
