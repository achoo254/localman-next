import { collectionsTabs } from "./collections-tabs";
import { collectionsTrash } from "./collections-trash";

/** Collections of the API client: sidebar tree, dialogs and the Trash page. */
export const collections = {
	rail: {
		collections: "Collections",
		trash: "Trash",
	},
	sidebar: {
		title: "Collections",
		new: "Create",
		import: "Import",
		readOnly: "Viewers can't add collections to this workspace.",
		search: "Search collections",
		searchPlaceholder: "Search collections, requests…",
		sort: "Sort collections: {label}",
		sortHeading: "Sort collections",
		favoritesFirst: "Favorites always come first.",
		loading: "Loading collections…",
		loadFailed: "We couldn't load the collections.",
		noMatch: "Nothing matches “{query}”.",
		itemsLoading: "Loading items…",
		itemsFailed: "We couldn't load the items.",
		searching: "Searching…",
		searchFailed: "We couldn't search the collections.",
		resultsLabel: "Search results",
		results: {
			one: "{count} match",
			other: "{count} matches",
		},
		truncated:
			"Showing the first {max} matches. Type more to narrow them down.",
		openFailed: "We couldn't open {name}.",
	},
	sorts: {
		nameAsc: "Name A–Z",
		nameDesc: "Name Z–A",
		updated: "Recently updated",
	},
	empty: {
		title: "No collections yet",
		body: "Keep requests in collections to save them, share them with your team and export them.",
		new: "New collection",
		import: "Import",
	},
	newMenu: {
		blank: "Blank collection",
		template: "REST CRUD template",
		fromMock: "From mock project…",
	},
	defaults: {
		collection: "New collection",
		folder: "New folder",
		request: "New request",
		importedCollection: "Imported collection",
		importedFolder: "Folder",
		importedRequest: "Request",
	},
	row: {
		star: "Add {name} to favorites",
		unstar: "Remove {name} from favorites",
		more: "More actions for {name}",
		rename: "New name for {name}",
	},
	dnd: {
		instructions:
			"To move an item, press Space. Use the arrow keys to move it over another row, then Space to drop it or Escape to cancel.",
		picked: "Picked up {name}.",
		over: "Over {target}.",
		dropped: "Dropped {name}.",
		cancelled: "Stopped moving {name}.",
	},
	menu: {
		addRequest: "Add request",
		addFolder: "Add folder",
		rename: "Rename",
		duplicate: "Duplicate",
		share: "Share",
		copyLink: "Copy link",
		move: "Move",
		export: "Export",
		delete: "Delete",
	},
	toast: {
		created: "Created {name}.",
		favorited: "{name} now comes first.",
		duplicated: "Duplicated {name}.",
		linkCopied: "Link copied. Only people with access can open it.",
		linkFailed: "We couldn't copy the link. Copy it from Share instead.",
		exported: "Downloaded {file}.",
		exportFailed: "We couldn't export {name}.",
		moved: "Moved {name} to {workspace}.",
		trashed: "Moved {name} to the Trash.",
		nodeDeleted: "Deleted {name}.",
		saved: "Saved {name} to {workspace}.",
	},
	deleteCollection: {
		title: "Delete collection",
		body: {
			one: "“{name}” and its {count} request move to the Trash.",
			other: "“{name}” and its {count} requests move to the Trash.",
		},
		bodyEmpty: "“{name}” moves to the Trash.",
		kept: {
			one: "It's kept for {count} day. People with access can restore it until then.",
			other:
				"It's kept for {count} days. People with access can restore it until then.",
		},
		typeLabel: "Type <code>{word}</code> to confirm",
		submit: "Delete collection",
	},
	deleteNode: {
		folderTitle: "Delete folder",
		requestTitle: "Delete request",
		question: "Delete “{name}”?",
		folderBody: {
			one: "The folder and the {count} request inside it are deleted for good. This can't be undone.",
			other:
				"The folder and the {count} requests inside it are deleted for good. This can't be undone.",
		},
		requestBody: "The request is deleted for good. This can't be undone.",
		confirm: "Delete",
	},
	move: {
		title: "Move “{name}”",
		intro:
			"Members of the destination workspace get access by their role there. People it's shared with keep their access.",
		legend: "Destination workspace",
		current: "Current workspace",
		teamToPersonal: "A team collection can't move to a personal workspace.",
		noAccess: "You can't add collections there.",
		personal: "Only you see it.",
		team: "Members see it by their role.",
		submit: "Move",
	},
	import: {
		modeLegend: "Import as",
		tabs: "Open as tabs",
		collection: "Save as collection",
		collectionHint:
			"Saved in {workspace} with its folders, auth, scripts and variables.",
		submit: "Save collection",
	},
	fromMock: {
		title: "Collection from a mock project",
		intro:
			"Each resource becomes a folder with its list, get, create, update and delete requests. Record ids become variables such as <code>{example}</code>.",
		submit: "Create collection",
	},
	errors: {
		forbidden: "Your role doesn't allow this. Ask an Admin or Editor.",
		notFound: "This item no longer exists or you lost access to it.",
		teamToPersonal: "A team collection can't move to a personal workspace.",
		workspaceMissing: "Its workspace was deleted. Restore it from the Trash.",
		sameWorkspace: "It's already in that workspace.",
		collectionLimit:
			"This workspace holds the most collections it can. Delete one first.",
		nodesLimit:
			"This collection holds the most folders and requests it can. Delete some first.",
		tooDeep: "Folders can't be nested any deeper.",
		moveCycle: "A folder can't go inside itself.",
		moveFailed: "We couldn't move it there. Refresh and try again.",
		tooLarge: "It's too large to save.",
		confirmation: "Type the confirmation word to delete it.",
		invalid: "Some of it isn't valid, so we couldn't save it.",
		rateLimited: "Too many changes at once. Please wait a moment.",
		fallback: "We couldn't do that. Please try again.",
	},
	trash: collectionsTrash,
	...collectionsTabs,
} as const;
