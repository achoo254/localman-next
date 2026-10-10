/** Webhook inboxes of a project: the Inbox tab of the endpoint card and its form. */
export const webhookInbox = {
	title: "Webhook inbox",
	intro:
		"Public URLs that catch webhooks from outside services. They accept any method, answer with the response you set, and can forward to your machine through a tunnel.",
	count: "{used} / {max} inboxes",
	create: "Create inbox",
	readonly:
		"You're viewing as a collaborator. Only the project owner can create, change and delete inboxes.",
	loading: "Loading inboxes…",
	loadFailed: "Couldn't load the inboxes. Try again.",
	footnote:
		"Requests to an inbox show up in the request log with source <code>inbox</code>, have sensitive headers masked and count toward your mock request quota.",
	empty: {
		title: "No inboxes yet",
		body: "Create an inbox, paste its URL into the webhook settings of the sending service, then watch requests arrive in the request log.",
	},
	item: {
		response: "Answers {status} · {contentType}",
		forwards: "Forwards to <code>{target}</code>",
		noForward: "No forwarding",
		requests: { one: "{count} request", other: "{count} requests" },
		viewLog: {
			one: "See the {count} request of inbox {name} in the request log",
			other: "See the {count} requests of inbox {name} in the request log",
		},
		url: "URL",
		urlItem: "URL of inbox {name}",
		lastForward: "Last forward",
		lastForwardAt: "Last forward {time}",
		noForwardYet: "No request to forward yet.",
		edit: "Edit inbox {name}",
		delete: "Delete inbox {name}",
	},
	remove: {
		title: "Delete webhook inbox",
		question: "Delete inbox <code>{name}</code>?",
		body: "The URL stops accepting requests right away and senders get 404. Requests already logged stay in the request log until they expire.",
		confirm: "Delete inbox",
		done: "Deleted inbox <code>{name}</code>.",
	},
	form: {
		titleNew: "Create webhook inbox",
		titleEdit: "Edit inbox {name}",
		name: "Name",
		nameHint:
			"Lowercase letters, digits and <code>-</code>, up to 32 characters.",
		urlPreview: "URL:",
		responseTitle: "Response to the sender",
		status: "Status",
		contentType: "Content-Type",
		body: "Body",
		forward: "Forward to your machine (optional)",
		forwardHelp:
			"Sends a copy of each request to your tunnel. Retries up to 3 times on a network error, a 30-second timeout or a 5xx. The sender still gets the response above.",
		port: "Port",
		path: "Path",
		target: "Target: <code>{target}</code>",
		submitNew: "Create inbox",
		submitEdit: "Save inbox",
		created:
			"Created inbox <code>{name}</code>. Paste its URL into the sender's webhook settings.",
		saved: "Saved inbox <code>{name}</code>.",
		forwardFailed:
			"Created inbox {name}, but couldn't turn on forwarding: {reason} Save again to retry.",
		errors: {
			nameEmpty: "Enter an inbox name.",
			nameFormat:
				"Use lowercase letters, digits and -, not at the start or end.",
			nameTaken: "This project already has an inbox with this name.",
			status: "Status must be a whole number from 200 to 599.",
			bodyJson:
				"The body isn't valid JSON. Switch Content-Type to send plain text.",
			port: "Port must be between 1 and 65535.",
			path: "The path starts with / and has no spaces, ? or #.",
		},
	},
} as const;
