/**
 * Changelog, activity and trash-list shapes of the collections API. Plain
 * types: the API validates its output with its own zod views.
 */
import type { CollectionStatus } from "./collection-tags.js";

export const CHANGELOG_ACTIONS = [
	/** The collection was created (empty, imported, from a template, copied). */
	"create",
	"update",
	"move",
	"delete",
	/** The collection went to the trash, or came back from it. */
	"trash",
	"untrash",
	/** "Restore to this change". */
	"restore",
	/** A fork's changes merged in (`entityName` is the fork's label). */
	"merge",
	/** The source's changes pulled into a fork (`entityName` is the source). */
	"pull",
] as const;

/** Actions that rewrite the whole collection in one change. */
export const WHOLE_COLLECTION_ACTIONS: readonly ChangelogAction[] = [
	"restore",
	"merge",
	"pull",
];
export type ChangelogAction = (typeof CHANGELOG_ACTIONS)[number];

export type ChangelogEntity = "collection" | "node";
export type ChangelogEntityKind =
	| "collection"
	| "folder"
	| "request"
	| "example";

/**
 * A session is one author's consecutive changes within this window from
 * the session's first (oldest) change; a later change starts a new one.
 */
export const CHANGELOG_SESSION_WINDOW_MS = 5 * 60_000;
/** Revisions kept per collection; older ones are trimmed. */
export const CHANGELOG_REVISIONS_MAX = 2_000;

export interface ChangelogChange {
	id: string;
	at: string;
	action: ChangelogAction;
	entity: ChangelogEntity;
	entityId: string;
	entityKind: ChangelogEntityKind;
	/** Its name at the time of the change. */
	entityName: string;
	/** Top-level fields it changed (`name`, `draft`, `order`…), if any. */
	fields: string[];
	/** `fields` joined, for clients without their own wording. */
	summary: string;
	/** Its diff is hidden; only these details are shown. */
	hidden: boolean;
	/** "Restore to this change" can go back to it. */
	restorable: boolean;
	/** Made by an agent through Localman MCP, not in the web app. */
	viaMcp: boolean;
}

export interface ChangelogSession {
	authorId: string;
	/** Name (else username); `null` for a removed account. */
	authorName: string | null;
	/** Oldest and newest change of the session. */
	from: string;
	to: string;
	/** Newest first. */
	changes: ChangelogChange[];
}

export interface ChangelogPage {
	/** Newest first. */
	sessions: ChangelogSession[];
	/** Send as `before` for the next (older) page; `null` at the end. */
	nextBefore: string | null;
}

/** The entity before and after one change. */
export interface ChangelogDiff {
	revisionId: string;
	hidden: boolean;
	/** `false` when the change kept no patches (too large) or is hidden. */
	available: boolean;
	/** `null` when it did not exist (creation) or the diff is unavailable. */
	before: unknown;
	after: unknown;
	/**
	 * A "Restore to this change" rewrites many nodes: which ones it added,
	 * removed or changed (its `before`/`after` are the collection root).
	 */
	affected?: AffectedNode[];
}

export interface AffectedNode {
	nodeId: string;
	/** Its name in the change, or now; `null` when unknown. */
	name: string | null;
	change: "added" | "removed" | "changed";
}

export interface ActivityItem extends ChangelogChange {
	authorId: string;
	authorName: string | null;
}

/** A collection in the trash, as `GET /trash/collections` lists it. */
export interface TrashedCollectionSummary {
	id: string;
	name: string;
	workspaceId: string;
	/** `null` once that workspace is deleted too. */
	workspaceName: string | null;
	requestCount: number;
	tags: string[];
	status: CollectionStatus | null;
	deletedAt: string;
	deletedBy: string;
	deletedByName: string | null;
	purgeAt: string;
}

export interface TrashList {
	items: TrashedCollectionSummary[];
	/** Everyone who deleted something the caller may restore (the filter). */
	deleters: { id: string; name: string | null }[];
}
