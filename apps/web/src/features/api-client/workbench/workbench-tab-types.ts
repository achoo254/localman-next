/**
 * Tab shapes beside the request tab: collection and folder pages, what a
 * bound request inherits at send time, options of a new tab and the
 * draft sync status.
 */
import type {
	ApiRequestDraft,
	EffectiveAuth,
	TabSource,
	VariableEntry,
} from "@localman/shared/api-client";

/**
 * A collection, folder or example open as a tab (not a request, never a
 * draft).
 */
export interface CollectionPageTab {
	id: string;
	kind: "collection" | "folder" | "example";
	collectionId: string;
	/** The folder or example; `null` for the collection itself. */
	nodeId: string | null;
	/** Shown in the tab bar until the page loads its own. */
	name: string;
}

/** An environment, or a workspace's globals, open as a tab. */
export interface VariablesPageTab {
	id: string;
	kind: "environment" | "globals";
	/** The environment's id, or the workspace's for its globals. */
	targetId: string;
	name: string;
}

/** A page in the tab bar: it saves itself, so it is never a draft. */
export type PageTab = CollectionPageTab | VariablesPageTab;

export function isCollectionPage(page: PageTab): page is CollectionPageTab {
	return page.kind !== "environment" && page.kind !== "globals";
}

/**
 * What a request of a collection takes from above it when sent: the auth
 * an `inherit` request uses, scripts in run order (collection, folders,
 * the request last) and the collection variables.
 */
export interface SendContext {
	inheritedAuth: EffectiveAuth;
	preScripts: string[];
	postScripts: string[];
	variables: VariableEntry[];
}

/** State of saving drafts to the server, for the status bar. */
export type DraftSyncStatus =
	| { state: "loading" }
	| { state: "idle" }
	| { state: "saving" }
	| { state: "saved" }
	/** `message` is the whole sentence to show, in the language on screen. */
	| { state: "error"; message: string };

export interface OpenTabOptions {
	/** Files the draft's `FileRef`s point to (an import with attachments). */
	files?: ReadonlyMap<string, File>;
	/** Switch to the new tab (default true). */
	activate?: boolean;
	/** The draft comes from history with its credentials hidden. */
	redacted?: boolean;
	/** The collection request the tab edits. */
	source?: TabSource;
	/** That request's saved draft (the tab opens clean when they match). */
	saved?: ApiRequestDraft;
}
