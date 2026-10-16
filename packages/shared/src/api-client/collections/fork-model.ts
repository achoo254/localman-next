/**
 * Forks of collections and environments, pulling changes and merging
 * them back. Plain types: the API validates its output with zod views.
 */

export const FORK_LABEL_MAX = 64;

/**
 * How a fork's changes reach its source: `merge` writes them to the
 * source; `mergeAndUpdate` also writes the merged result back to the fork
 * (needs Editor there too); `mergeAndDelete` merges and then moves the fork
 * to the trash (needs Editor there too).
 */
export const MERGE_OPTIONS = [
	"merge",
	"mergeAndUpdate",
	"mergeAndDelete",
] as const;
export type MergeOption = (typeof MERGE_OPTIONS)[number];

/**
 * A conflict's choice: `source` keeps the side the changes come from (the
 * fork when merging, the source when pulling), `destination` the side
 * being written.
 */
export const CONFLICT_SIDES = ["source", "destination"] as const;
export type ConflictSide = (typeof CONFLICT_SIDES)[number];

export type ForkKind = "collection" | "environment";

export interface ForkSourceView {
	id: string;
	/** `null` when it is gone or the caller cannot open it. */
	name: string | null;
	available: boolean;
}

/** What makes a collection or environment a fork. */
export interface ForkInfo {
	label: string;
	createdBy: string;
	createdByName: string | null;
	createdAt: string;
	source: ForkSourceView;
}

/** Whether it is a fork, and how many forks it has. */
export interface ForkStatus {
	fork: ForkInfo | null;
	forkCount: number;
}

export interface ForkListItem {
	forkId: string;
	label: string;
	createdByName: string | null;
	createdAt: string;
	/** The caller may open the fork itself. */
	canOpen: boolean;
}

export type MergeEntityKind =
	| "collection"
	| "folder"
	| "request"
	| "example"
	| "environment"
	| "variable";

export interface MergeChange {
	kind: "added" | "removed" | "changed";
	entityKind: MergeEntityKind;
	name: string;
}

export interface MergeConflictView {
	/** Send back as a key of `resolutions`. */
	id: string;
	entityKind: MergeEntityKind;
	name: string;
	/** Dotted field path; `""` when one side deleted it. */
	path: string;
	base: unknown;
	source: unknown;
	destination: unknown;
}

/** What a pull or merge would change on the destination, and its conflicts. */
export interface MergePreview {
	changes: MergeChange[];
	conflicts: MergeConflictView[];
}
