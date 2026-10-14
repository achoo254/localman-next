/**
 * Server gate of public sharing (`PUBLIC_SHARING_ENABLED`). The working
 * tree is deployed by whichever session ships next, so the web flag alone
 * would not keep unreleased public endpoints and MCP tools off production:
 * while the gate is off, the operations of this module are neither routed
 * nor offered over MCP, and their paths answer 404 like any unknown path.
 * The registry still lists them, so MCP coverage and OpenAPI checks see them.
 */
import type { AnyOperation } from "@localman/operations";
import { publicSharingOperations } from "./public-sharing-operations.js";

const gated: ReadonlySet<AnyOperation> = new Set(publicSharingOperations);

/** The registry as served: public sharing left out while the gate is off. */
export function servedOperations(
	operations: readonly AnyOperation[],
	publicSharingEnabled: boolean,
): readonly AnyOperation[] {
	return publicSharingEnabled
		? operations
		: operations.filter((operation) => !gated.has(operation));
}
