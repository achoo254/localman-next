import { createRequestDraft } from "@localman/shared/api-client";
import { blankExampleResponse } from "./example-response";
import type { NodeCreate } from "./nodes-api";
import type { TreeRow } from "./tree-rows";

export type NewNodeKind = "folder" | "request" | "example";

/**
 * A node added from a row's menu: a folder or request inside a collection
 * or folder, an example (blank response, the request as saved) under a
 * request. `null` when the row cannot hold that kind.
 */
export function newNode(
	row: TreeRow,
	kind: NewNodeKind,
	name: string,
): NodeCreate | null {
	if (kind === "example") {
		if (row.kind !== "request") return null;
		return {
			kind,
			parentId: row.id,
			name,
			request: row.node.draft,
			response: blankExampleResponse(),
		};
	}
	if (row.kind !== "collection" && row.kind !== "folder") return null;
	const parentId = row.kind === "collection" ? null : row.id;
	return kind === "folder"
		? { kind, parentId, name }
		: { kind, parentId, name, draft: createRequestDraft({ name }) };
}
