/** `{{variables}}` in the request editors: hover card, suggestions, Set as variable. */
export const variables = {
	scope: {
		global: "Global",
		collection: "Collection",
		environment: "Environment",
		temporary: "Temporary",
		dynamic: "Dynamic",
		response: "Response",
	},
	reference: {
		note: "The value at <code>{path}</code> of the last response of <b>{request}</b>; sending this request sends “{request}” again first when that response is older than {ttl} s.",
		value: "Value now",
		notSent:
			"“{request}” has not been sent in this tab yet: sending this request sends it first.",
		missing: "The last response of “{request}” has no value at this path.",
	},
	tooltip: {
		empty: "(empty)",
		secret: "Secret value hidden",
		unreadableValue: "Sealed by another vault",
		unreadableNote:
			"Your local value of this secret ({scope}) was sealed by another vault and cannot be opened. Requests using <code>{token}</code> stop until you replace or remove it.",
		withheld: "Hidden from you: set your own local value to use it",
		locked: "Locked",
		lockedValue: "Locked in the vault",
		lockedNote:
			"Your local value of this secret ({scope}) is in the locked vault. Requests using <code>{token}</code> stop without sending until you unlock it.",
		unlock: "Unlock vault",
		openEnvironment: "Open {name}",
		openGlobals: "Open globals",
		noValue: "(no value)",
		from: "Value from {scope}",
		fromNamed: "Value from {scope} · {name}",
		overridden: "Overridden",
		disabled: "(disabled)",
		precedence: "Precedence: Global < Collection < Environment < Temporary",
		dynamic: "A new value is generated each time the request is sent.",
		undeclared: "Undeclared",
		undeclaredNote:
			"No scope in use declares this variable, so <code>{token}</code> is sent as typed.",
		inactiveNote:
			"A variable with this name exists but is disabled or has no value.",
	},
	add: {
		scope: "Add to",
		value: "Value",
		submit: "Add variable",
		viewerNote: "Viewers can add temporary variables only.",
	},
	choice: {
		environment: "Environment · {name}",
		environmentNone: "Environment",
		collection: "Collection · {name}",
		collectionNone: "Collection",
		global: "Globals",
		temporary: "Temporary (this tab)",
		help: {
			environment: "Shared value, synced to everyone with access",
			collection: "Shared with everyone who can open the collection",
			global: "Used by every request in this workspace",
			temporary: "Only in this tab until it closes; overrides every scope",
		},
		blocked: {
			editorsOnly: "Only Editors can change this scope",
			noEnvironment: "No environment is active",
			noCollection: "This request is not saved in a collection",
			noWorkspace: "Globals are not loaded yet",
		},
		option: "{label} ({reason})",
	},
	set: {
		action: "Set as variable",
		title: "Set as variable",
		name: "Variable name",
		namePlaceholder: "authToken",
		value: "Value",
		scope: "Scope",
		submit: "Set variable",
		done: "{name} set in {scope}",
		failed: "We couldn't set the variable.",
		localReset: "Your local value was reset so the new value applies.",
		localKept:
			"Your local value of {name} could not be reset and still overrides the new value.",
		errors: {
			nameRequired: "Enter a name.",
			nameInvalid:
				"Use a name without spaces or braces that does not start with $.",
			nameTooLong: "Use at most {max} characters.",
			valueTooLong: "The value can have at most {max} characters.",
		},
	},
	existing: {
		replace:
			"{name} already exists here. Setting it replaces its shared value for everyone who uses this scope.",
		disabled:
			"It is disabled and stays disabled: the new value is not used until an Editor turns it on.",
		local: "Your local value of it will be reset so the new value applies.",
	},
	suggest: {
		label: "Variable suggestions",
	},
	temporary: {
		title: "Temporary variables",
		note: "Kept in this tab only and lost when it closes. They override every scope.",
		empty:
			"No temporary variables in this tab. Select text and use Set as variable to add one.",
		caption: "Temporary variables of this tab",
		remove: "Remove {name}",
	},
} as const;
