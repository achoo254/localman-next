import type { AnyOperation } from "@localman/operations";
import { changelogOperations } from "./changelog-operations.js";
import { registerCollectionAdapter } from "./collection-adapter.js";
import {
	favoriteCollectionOperation,
	unfavoriteCollectionOperation,
} from "./collection-favorite-operations.js";
import { collectionNodeBatchOperations } from "./collection-node-batch-operations.js";
import { collectionNodeOperations } from "./collection-node-operations.js";
import { collectionReadOperations } from "./collection-read-operations.js";
import { searchCollectionsOperation } from "./collection-search-operations.js";
import { collectionTrashOperations } from "./collection-trash-operations.js";
import { collectionWriteOperations } from "./collection-write-operations.js";

// Whatever serves these operations (dashboard, MCP) also shares and moves
// collections through the access layer, so the adapter comes with them.
registerCollectionAdapter();

/** Collection, node, trash and export operations (registered in the registry). */
export const collectionOperations: readonly AnyOperation[] = [
	...collectionReadOperations,
	searchCollectionsOperation,
	...collectionWriteOperations,
	...collectionNodeOperations,
	...collectionNodeBatchOperations,
	favoriteCollectionOperation,
	unfavoriteCollectionOperation,
	...collectionTrashOperations,
	...changelogOperations,
];
