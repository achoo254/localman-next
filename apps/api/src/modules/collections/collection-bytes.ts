import { OperationError } from "@localman/operations";
import type {
	ApiRequestDraft,
	CollectionRootFields,
	ExampleResponse,
	RequestAuth,
	RequestScripts,
} from "@localman/shared/api-client";

/**
 * Content one collection may hold, as UTF-8 bytes of JSON: a request is
 * capped at the saved-draft size, this caps the sum, so loading or
 * exporting a collection stays bounded.
 */
export const COLLECTION_BYTES_MAX = 20 * 1024 * 1024;

/** What a node stores beyond its place in the tree. */
export type NodePayload =
	| {
			readonly kind: "request";
			readonly name: string;
			readonly description: string;
			readonly draft: ApiRequestDraft;
	  }
	| {
			readonly kind: "folder";
			readonly name: string;
			readonly description: string;
			readonly auth: RequestAuth;
			readonly scripts: RequestScripts;
	  }
	| {
			readonly kind: "example";
			readonly name: string;
			readonly request: ApiRequestDraft;
			readonly response: ExampleResponse;
	  };

function jsonBytes(value: unknown): number {
	return Buffer.byteLength(JSON.stringify(value), "utf8");
}

export function rootBytes(root: CollectionRootFields): number {
	const { name, description, auth, scripts, variables, tags, status } = root;
	return jsonBytes([name, description, auth, scripts, variables, tags, status]);
}

export function nodeBytes(node: NodePayload): number {
	if (node.kind === "example") {
		return jsonBytes([node.name, node.request, node.response]);
	}
	return node.kind === "request"
		? jsonBytes([node.name, node.description, node.draft])
		: jsonBytes([node.name, node.description, node.auth, node.scripts]);
}

export function collectionTooLarge(bytes: number): OperationError {
	return new OperationError(
		413,
		"COLLECTION_TOO_LARGE",
		`A collection holds at most ${COLLECTION_BYTES_MAX} bytes of content`,
		{ max: COLLECTION_BYTES_MAX, bytes },
	);
}
