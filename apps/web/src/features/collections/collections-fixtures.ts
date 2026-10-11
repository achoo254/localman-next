/** Folder and request nodes for the collections tests. */
import {
	type CollectionFolderNode,
	type CollectionRequestNode,
	createRequestDraft,
} from "@localman/shared/api-client";

export function folder(
	id: string,
	parentId: string | null,
	order: string,
	name = `Folder ${id}`,
): CollectionFolderNode {
	return {
		kind: "folder",
		id,
		parentId,
		order,
		name,
		description: "",
		auth: { type: "inherit" },
		scripts: { pre: "", post: "" },
	};
}

export function request(
	id: string,
	parentId: string | null,
	order: string,
	name = `Request ${id}`,
): CollectionRequestNode {
	return {
		kind: "request",
		id,
		parentId,
		order,
		name,
		description: "",
		draft: createRequestDraft({ name, url: `https://api.test/${id}` }),
	};
}
