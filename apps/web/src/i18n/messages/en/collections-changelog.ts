/** The changelog panel: sessions, diffs, hiding and restoring changes. */
export const collectionsChangelog = {
	changelog: {
		title: "Changelog",
		intro:
			"Changes one person makes within 5 minutes of their first change are grouped into one session.",
		changes: {
			one: "{count} change",
			other: "{count} changes",
		},
		viewDiff: "View diff",
		closeDiff: "Close diff",
		hide: "Hide diff",
		hideNote:
			"Hides this diff from viewers; editors still see it. It doesn't remove the data from the collection's history.",
		irreversible:
			"This change is too large to keep in the changelog. You won't be able to undo it or restore earlier changes.",
		show: "Show diff",
		hidden: "Diff hidden by an editor.",
		hiddenFromViewers:
			"This diff is hidden from viewers. You can see it because you're an editor.",
		unavailable: "This change was too large to keep its diff.",
		diffFailed: "We couldn't load this diff.",
		before: "Before",
		after: "After",
		diffLabel: "Changes to {name}",
		noChange: "Nothing changed in the content.",
		unchangedLines: {
			one: "Show {count} unchanged line",
			other: "Show {count} unchanged lines",
		},
		moreLines: {
			one: "Show {count} more line",
			other: "Show {count} more lines",
		},
		affected: {
			title: "Items this restore changed",
			added: "Added {name}",
			removed: "Removed {name}",
			changed: "Changed {name}",
			unnamed: "an item",
		},
		restore: "Restore",
		restoreTitle: "Restore to this change",
		restoreNeedsEditor: "Only editors can restore a change.",
		restoreQuestion:
			"Restore the collection to how it was right after this change?",
		restoreBody: "This adds a new change; nothing is lost.",
		restored: "Restored the collection.",
		editsDiscarded:
			"Edits on open pages that weren't saved yet were discarded so they don't overwrite the restore.",
		unavailableRestore:
			"This change can no longer be restored: a later change was too large to keep, or it was trimmed.",
		loadOlder: "Load older",
		loading: "Loading the changelog…",
		empty: "No changes yet.",
		loadFailed: "We couldn't load the changelog.",
		removedAccount: "Removed account",
		viaMcp: "via MCP",
		kinds: {
			collection: "collection",
			folder: "folder",
			request: "request",
			example: "example",
		},
		describe: {
			create: "Created {kind} {name}",
			update: "Edited {fields} of {kind} {name}",
			rename: "Renamed {kind} {name}",
			move: "Moved {kind} {name}",
			delete: "Deleted {kind} {name}",
			trash: "Moved the collection to the Trash",
			untrash: "Restored the collection from the Trash",
			restore: "Restored the collection to an earlier change",
			merge: "Merged changes from the fork {name}",
			pull: "Pulled changes from {name}",
			sync: "Synced with the mock project {name}",
		},
		fields: {
			name: "name",
			description: "description",
			auth: "auth",
			scripts: "scripts",
			draft: "request",
			variables: "variables",
			tags: "tags",
			status: "status",
			order: "position",
			parentId: "location",
			request: "request",
			response: "response",
		},
	},
} as const;
