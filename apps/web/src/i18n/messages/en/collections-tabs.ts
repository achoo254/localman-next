/** Collection and folder tabs, saving requests into collections. */
export const collectionsTabs = {
	page: {
		kind: {
			collection: "Collection",
			folder: "Folder",
			example: "Example",
		},
		nameLabel: {
			collection: "Collection name",
			folder: "Folder name",
			example: "Example name",
		},
		loadFailed: "We couldn't load this collection.",
		folderGone: "This folder no longer exists. Close its tab.",
		share: "Share",
		readOnly: "You can view this collection. Ask an Editor to change it.",
		tabs: {
			label: "Collection sections",
			overview: "Overview",
			authorization: "Authorization",
			scripts: "Scripts",
			variables: "Variables",
		},
		status: {
			saving: "Saving…",
			saved: "All changes saved",
			error: "Not saved: {message}",
		},
		overview: {
			description: "Description",
			edit: "Edit",
			save: "Save",
			inputLabel: "Description in Markdown",
			hint: "Markdown: headings, lists, **bold**, *italic*, `code` and links.",
			empty: "No description yet.",
			details: "Details",
			createdBy: "Created by",
			you: "You",
			member: "A workspace member",
			updated: "Last updated",
			updatedBy: "{time} by {name}",
			workspace: "Workspace",
			requests: "Requests",
		},
		auth: {
			note: "Requests set to Inherit auth from parent use this.",
			folderInherit:
				"This folder uses the auth of its parent folder, or of the collection.",
		},
		scripts: {
			order:
				"On send, scripts run in this order: collection, then folders from the outside in, then the request.",
		},
		variables: {
			caption: "Collection variables",
			hint: "Use them as <code>{example}</code> in this collection's requests. Secret values are hidden and left empty in exports.",
			secret: "Secret",
			enable: "Use {name}",
			keyOf: "Key of row {n}",
			valueOf: "Value of {name}",
			markSecret: "Hide the value of {name}",
			remove: "Remove {name}",
			add: "Add variable",
			empty: "No variables yet.",
		},
	},
	save: {
		title: "Save to collection",
		name: "Request name",
		collection: "Collection",
		folder: "Folder",
		top: "Top level",
		submit: "Save",
		saved: "Saved {name} to {collection}.",
		noCollection:
			"There is no collection you can edit in this workspace. Create one first.",
		button: "Save",
		buttonLabel: "Save to collection",
		goneTitle: "Kept as a loose request",
		gone: "Its collection request no longer exists, so this tab is no longer linked to it. Your edits are still here.",
	},
	breadcrumb: {
		label: "Collection path",
	},
	inherit: {
		loading: "Finding where the auth comes from…",
		fromFolder: "Inherited from folder <link>{name}</link>",
		fromCollection: "Inherited from collection <link>{name}</link>",
		failed: "We couldn't read its collection: {reason}",
		gone: "This request is no longer in its collection, so it has no parent auth.",
	},
	send: {
		unavailable:
			"Not sent: its collection can't be read ({reason}). Its auth and scripts would be missing.",
		gone: "the request is no longer in it",
	},
} as const;
