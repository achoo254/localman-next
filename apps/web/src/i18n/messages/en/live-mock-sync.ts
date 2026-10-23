/** Live Mock Sync: collections that follow a mock project. */
export const liveMockSync = {
	badge: {
		label: "Synced with mock",
		title: "Live Mock Sync with {name}",
		project: "Live Mock Sync",
	},
	settings: {
		title: "Live Mock Sync · {name}",
		toggle: "Sync from mock",
		toggleHint:
			"One way, mock to collection. Off, the collection becomes an ordinary collection and keeps its content.",
		project: "Mock project",
		projectHidden: "The mock project is gone, or you can't open it.",
		environment: "Environment",
		environmentHint:
			"Live Mock Sync manages baseUrl and the id variable of each resource there.",
		noEnvironment: "No environment",
		lastSynced: "Last synced {time}",
		behaviour:
			"What you edit yourself (headers, body, scripts) stays. When the mock changes the same thing, you choose. Requests the mock no longer serves move to the _removed folder.",
		needEditor:
			"Only Editors of both the mock project and the collection turn the sync on or off.",
		urlChanged:
			"The mock project's secret changed. Live Mock Sync does not copy the new mock URL into the shared environment; update baseUrl yourself if everyone here may use it.",
		save: "Save",
		stopped:
			"Sync turned off. {name} is now an ordinary collection and keeps its content.",
	},
	banner: {
		title: "The mock changed fields you edited",
		count: {
			one: "{count} conflict waits for your choice.",
			other: "{count} conflicts wait for your choice.",
		},
		resolve: "Review and choose",
	},
	conflicts: {
		title: "Changes from {name}",
		intro: "Pick what to keep wherever the mock changed something you edited.",
		sides: "Take from mock applies the mock's value; Keep mine leaves yours.",
		keepMock: "Take from mock",
		keepMine: "Keep mine",
		allMock: "Take all from mock",
		allMine: "Keep all mine",
		submit: "Apply",
		done: "Applied the changes from {name}",
		nothing: "Nothing is waiting: the collection already follows the mock.",
		loading: "Comparing with the mock…",
	},
	project: {
		create: "Create synced collection",
		open: "Open synced collection",
		created: "Created {name}, synced with this mock",
		noWorkspace: "Pick a workspace in the API client first.",
	},
	names: {
		removedFolder: "Requests the mock no longer serves. Delete them when done.",
		removedItem: "Removed from the mock.",
		environment: "{name} (mock)",
	},
} as const;
