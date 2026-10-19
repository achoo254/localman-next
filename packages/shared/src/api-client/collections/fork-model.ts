/**
 * Forks of collections and environments, pulling changes and merging
 * them back. Plain types: the API validates its output with zod views.
 */

export const FORK_LABEL_MAX = 64;
/** Environments forked along with one collection, each counted as a fork. */
export const FORK_ENVIRONMENTS_MAX = 5;

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
	/** Whether the caller may merge this fork into it (Editor of the source). */
	canMerge: boolean;
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
	/** Stable across previews: what a pull request comment is about. */
	key: string;
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

export const PULL_REQUEST_TITLE_MAX = 200;
export const PULL_REQUEST_DESCRIPTION_MAX = 10_000;
/** Reviewers one pull request may ask. */
export const PULL_REQUEST_REVIEWERS_MAX = 20;
/** Open or approved pull requests one collection may receive. */
export const PULL_REQUESTS_OPEN_MAX = 100;

export type PullRequestStatus = "open" | "approved" | "declined" | "merged";
export type ReviewDecision = "pending" | "approved" | "declined";

export interface PullRequestReviewView {
	userId: string;
	name: string | null;
	decision: ReviewDecision;
	at: string | null;
}

export interface PullRequestView {
	id: string;
	sourceId: string;
	/** `null` when the caller cannot open it. */
	sourceName: string | null;
	forkId: string;
	/** The fork's label; `null` once the fork is gone. */
	forkLabel: string | null;
	title: string;
	description: string;
	authorId: string;
	authorName: string | null;
	reviewers: PullRequestReviewView[];
	status: PullRequestStatus;
	mergedByName: string | null;
	mergedAt: string | null;
	createdAt: string;
	/** The caller is a reviewer and it is open or approved. */
	canReview: boolean;
	/** The caller is an Editor of the source and it is open or approved. */
	canMerge: boolean;
	/** The caller wrote it and it is open or approved. */
	canEdit: boolean;
}

/** A pull request with its changes worked out now (`null` once closed). */
export interface PullRequestDetail extends PullRequestView {
	preview: MergePreview | null;
}

export interface ReviewerCandidate {
	userId: string;
	username: string;
	name: string | null;
}
