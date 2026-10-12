/**
 * Links between a collection and the mock project it was made from or its
 * related environment, as the collections API serves them.
 */
import type { EnvironmentColor } from "../environments/environment-model.js";

/** The mock project a collection was created from, readable by the caller. */
export interface CollectionMockProjectLink {
	id: string;
	name: string;
}

/**
 * The environment related to a collection: the one an Editor linked, else
 * (until an Editor chooses) the one shared together with the collection.
 */
export interface CollectionEnvironmentLink {
	id: string;
	name: string;
	color: EnvironmentColor;
	source: "linked" | "shared";
}

/** Most collections `GET /environments/:id/collections` lists. */
export const ENVIRONMENT_COLLECTIONS_MAX = 100;

/** A collection whose related environment is the one listed ("where used"). */
export interface EnvironmentCollectionUse {
	id: string;
	name: string;
	source: CollectionEnvironmentLink["source"];
}
