/**
 * Read-only pages of public sharing (public link, guest link, Run button)
 * and the workspace switches.
 */
export const publicSharingView = {
	page: {
		pageTitle: "Shared collection",
		readOnly: "read-only",
		updated: "Updated {date}",
		requests: {
			one: "{count} request",
			other: "{count} requests",
		},
		tree: "Folders and requests",
		emptyTree: "This collection has no requests yet.",
		overview: "Overview",
		variables: "Collection variables",
		noVariables: "No collection variables.",
		hidden: "hidden",
		notFoundTitle: "This link does not exist or was turned off",
		notFoundText:
			"Ask the person who shared it for a new link. Links stop working when they're turned off.",
		rateLimitedTitle: "Too many requests",
		rateLimitedText: "Wait a minute, then reload the page.",
		loadFailed: "Couldn't load this collection.",
		home: "Back to Localman",
	},
	request: {
		params: "Query params",
		headers: "Headers",
		auth: "Authorization",
		body: "Body",
		description: "Description",
		examples: "Examples",
		disabled: "off",
		noBody: "No body",
		file: "File: {name}",
		authTypes: {
			inherit: "Inherited from the folder or collection",
			none: "No auth",
			bearer: "Bearer token",
			basic: "Basic auth",
			apikey: "API key",
		},
		token: "Token",
		username: "Username",
		password: "Password",
		keyName: "Key",
		keyValue: "Value",
		keyIn: "Added to",
		keyInHeader: "Header",
		keyInQuery: "Query params",
		exampleStatus: "Status {status}",
		exampleBodyHidden: "Response bodies of examples are not published.",
		noExamples: "No examples.",
	},
	guest: {
		pageTitle: "Guest view",
		guestBadge: "guest",
		requestEdit: "Request edit access",
		openInWorkspace: "Open in workspace",
		note: "You're viewing a read-only copy. Opening this link gives you no access to the collection.",
	},
	run: {
		pageTitle: "Run in Localman",
		signInTitle: "Sign in to import this collection",
		signInText:
			"This Run in Localman button imports a copy of a collection into one of your workspaces. Sign in first; nothing is imported until you confirm.",
		signIn: "Sign in",
		signUp: "Create an account",
		workspace: "Import into",
		workspaceHint: "Workspaces where you're an Admin or Editor.",
		noWorkspace:
			"You aren't an Admin or Editor of any workspace, so there is nowhere to import it.",
		previewTitle: "What gets imported",
		requests: {
			one: "{count} request",
			other: "{count} requests",
		},
		environment: "Environment: {name}",
		environmentUnavailable:
			"Environment unavailable, only the collection is imported.",
		noEnvironment: "No environment.",
		scriptsTitle: "Scripts in this collection",
		noScripts: "No scripts.",
		scriptPhase: {
			pre: "pre-request",
			post: "post-response",
		},
		includeScripts: "Import scripts",
		includeScriptsHint:
			"Scripts run when you send requests and can read your environment values. Import them only if you trust who shared this.",
		import: "Import collection",
		doneTitle: "Imported",
		doneText: "“{name}” is now in your workspace.",
		openCollection: "Open the collection",
		environmentError:
			"The collection was imported, but its environment wasn't.",
	},
	workspace: {
		title: "Public sharing",
		text: "What Admins and Editors may publish from this workspace. Turning a switch off stops what exists at once; turning it on again resumes it.",
		readOnly: "Only Admins can change these settings.",
		loadFailed: "Couldn't load the sharing settings.",
		switches: {
			publicLinksAllowed: "Public links",
			guestsAllowed: "Guest links",
			accessKeysAllowed: "Access keys",
		},
		hints: {
			publicLinksAllowed:
				"Read-only pages anyone can open, and Run buttons anyone can use.",
			guestsAllowed:
				"Read-only pages for signed-in people, who can ask for edit access.",
			accessKeysAllowed: "Keys that let scripts read collections as JSON.",
		},
		offTitle: "Turn off {name}",
		offQuestion: "Turn off {name} for this workspace?",
		offStops:
			"These stop at once. Nothing is deleted, and turning it on again resumes them.",
		stopped: {
			links: { one: "{count} link", other: "{count} links" },
			accessKeys: { one: "{count} access key", other: "{count} access keys" },
			runButtons: { one: "{count} Run button", other: "{count} Run buttons" },
		},
		offCountsLoading: "Counting what stops…",
		offConfirm: "Turn off",
		saved: "Sharing settings saved.",
	},
} as const;
