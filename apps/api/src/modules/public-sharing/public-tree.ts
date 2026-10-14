import {
	type PublicCollectionView,
	nodesToCollectionTree,
	publicCollectionTree,
} from "@localman/shared/api-client";
import { z } from "zod";
import type { StoredCollection } from "../collections/collection-model.js";
import { loadCollectionDetail } from "../collections/collection-store.js";

/** The redacted collection; the only collection shape that leaves a workspace. */
export async function publicViewOf(
	collection: Pick<StoredCollection, "_id">,
): Promise<PublicCollectionView> {
	const detail = await loadCollectionDetail(collection._id, "viewer", null);
	return {
		name: detail.name,
		description: detail.description,
		tree: publicCollectionTree(nodesToCollectionTree(detail)),
		updatedAt: detail.updatedAt,
	};
}

/**
 * The tree is written by the shared serializer and is not checked again on
 * the way out: a stored collection older than a limit must still be served.
 */
export const publicCollectionView = z.object({
	name: z.string(),
	description: z.string(),
	/** A `CollectionTree`, as the export and import of collections use it. */
	tree: z.unknown(),
	updatedAt: z.string(),
});
