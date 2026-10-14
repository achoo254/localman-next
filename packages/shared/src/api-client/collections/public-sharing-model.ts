/**
 * Public sharing of a collection: a public link anyone can open, a guest
 * link for signed-in people, read-only access keys for scripts, and Run
 * buttons that import it into another workspace. Every one serves the
 * redacted tree (`publicCollectionTree`), never the internal view.
 */
import type { CollectionTree } from "../import/imported-collection.js";

/** Admin switches of a workspace; off stops what exists at once. */
export const WORKSPACE_SHARING_SWITCHES = [
	"publicLinksAllowed",
	"guestsAllowed",
	"accessKeysAllowed",
] as const;
export type WorkspaceSharingSwitch =
	(typeof WORKSPACE_SHARING_SWITCHES)[number];
export type WorkspaceSharingSettings = Record<WorkspaceSharingSwitch, boolean>;

export const COLLECTION_LINK_KINDS = ["public", "guest"] as const;
export type CollectionLinkKind = (typeof COLLECTION_LINK_KINDS)[number];

/** What a public or guest link shows: the redacted collection. */
export interface PublicCollectionView {
	name: string;
	description: string;
	tree: CollectionTree;
	updatedAt: string;
}

/** Team: members of the collection's workspace only; public: anyone signed in. */
export const RUN_BUTTON_VISIBILITIES = ["team", "public"] as const;
export type RunButtonVisibility = (typeof RUN_BUTTON_VISIBILITIES)[number];

/** A script a Run button would import, by place only. */
export interface ScriptLocation {
	/** Folder names, then the request name; empty for the collection. */
	path: string[];
	phase: "pre" | "post";
}
