/** The Trash page of deleted collections. */
export const collectionsTrash = {
	pageTitle: "Trash",
	title: "Trash",
	retention: {
		one: "Deleted collections are kept for {count} day, then deleted for good automatically.",
		other:
			"Deleted collections are kept for {count} days, then deleted for good automatically.",
	},
	back: "Workbench",
	search: "Search by name",
	searchPlaceholder: "Search by name",
	table: "Deleted collections",
	columns: {
		name: "Name",
		type: "Type",
		workspace: "Workspace",
		deletedBy: "Deleted by",
		deletedAt: "Deleted on",
		daysLeft: "Time left",
		actions: "Actions",
	},
	items: {
		one: "{count} request",
		other: "{count} requests",
	},
	typeCollection: "collection",
	deletedWorkspace: "Deleted workspace",
	removedAccount: "Removed account",
	daysLeft: {
		one: "{count} day",
		other: "{count} days",
	},
	restore: "Restore",
	restoreLabel: "Restore {name}",
	deletePermanently: "Delete permanently",
	deleteLabel: "Delete {name} permanently",
	emptyTitle: "The Trash is empty",
	emptyBody:
		"Collections you delete stay here for a while, so you can restore them.",
	noMatch: "Nothing matches “{query}”.",
	loading: "Loading the Trash…",
	loadFailed: "We couldn't load the Trash.",
	restoreModal: {
		title: "Restore “{name}”",
		workspace: "Restore into workspace",
		noWorkspace: "You can't add collections to any of your workspaces.",
		submit: "Restore",
	},
	purge: {
		title: "Delete permanently",
		question: "Delete “{name}” for good?",
		body: "Its folders and requests are deleted too. This can't be undone.",
		confirm: "Delete permanently",
	},
	toast: {
		restored: "Restored {name} into {workspace}.",
		purged: "Deleted {name} for good.",
	},
} as const;
