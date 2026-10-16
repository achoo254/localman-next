/**
 * Server gates of unreleased features (`PUBLIC_SHARING_ENABLED`,
 * `COMMENTS_ENABLED`). The working tree is deployed by whichever session
 * ships next, so a web flag alone would not keep unreleased endpoints and
 * MCP tools off production: while a gate is off, the operations of its
 * feature are neither routed nor offered over MCP, and their paths answer
 * 404 like any unknown path. The registry still lists them, so MCP
 * coverage and OpenAPI checks see them.
 */
import type { AnyOperation } from "@localman/operations";
import { commentOperations } from "../modules/comments/comment-operations.js";
import { publicSharingOperations } from "../modules/public-sharing/public-sharing-operations.js";
import { watchOperations } from "../modules/watch/watch-operations.js";

export interface FeatureGates {
	readonly publicSharing: boolean;
	readonly comments: boolean;
}

const COMMENT_OPERATIONS = [...commentOperations, ...watchOperations];

/** The registry as served: the operations of features whose gate is off left out. */
export function servedOperations(
	operations: readonly AnyOperation[],
	gates: FeatureGates,
): readonly AnyOperation[] {
	const off = new Set<AnyOperation>([
		...(gates.publicSharing ? [] : publicSharingOperations),
		...(gates.comments ? [] : COMMENT_OPERATIONS),
	]);
	return off.size === 0
		? operations
		: operations.filter((operation) => !off.has(operation));
}
