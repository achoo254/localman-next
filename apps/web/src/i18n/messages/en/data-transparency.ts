/**
 * `/your-data` and its landing block. Places, retention and log fields
 * come from `@localman/shared/data-policy`, which the API's tests check
 * against the code; every sentence is sourced in
 * `docs/legal-pages-review.md` ("Where your data lives"). Change them together.
 */
export const dataTransparency = {
	nav: "Your data",
	title: "Where your data lives",
	intro:
		"What {app} keeps on your device, what reaches its server and for how long, and what it logs. The retention periods and log fields on this page come from the same settings the app runs on.",
	promise: {
		title: "Secrets never leave the browser",
		body: "Your own values of secret variables are encrypted in your browser with a passphrase only you know; the server keeps only the ciphertext. Requests go straight from your browser to the API you call whenever the browser can send them. When {app} would switch a request that carries a secret or a credential to its proxy on its own, it asks you first.",
		exceptions:
			"Exceptions, each your choice: a request you send through the proxy (a tab set to Proxy, a host you always allow, or “Send through proxy” after a failed send) carries its secrets to the server on its way; a secret you let agents use is copied to the server, encrypted, for the hosts you list; and shared values of secret variables are encrypted with the server's key, so the people you share them with can use them.",
	},
	places: {
		device: "Your device",
		serverSealed: "Server, sealed",
		serverEncrypted: "Server, encrypted",
		server: "Server",
		passing: "Passes through",
	},
	table: {
		caption: "Data of the API client, where it is and how long it is kept",
		data: "Data",
		where: "Where",
		kept: "Kept",
	},
	kept: {
		neverSent: "Never sent",
		untilDeleted: "Until you delete it",
		notStored: "Not stored",
		days: { one: "{count} day", other: "{count} days" },
		daysByLimits: "{standard} days, {extended} with extended limits",
		cap: "at most {count} entries",
	},
	items: {
		vaultPassphrase: {
			title: "Vault passphrase and key",
			detail:
				"Typed in your browser only. The key stays in this browser's storage and is never sent. Forget the passphrase and the values it sealed are lost.",
		},
		vaultValues: {
			title: "Your own values of secret variables",
			detail:
				"Sealed in your browser before they are saved. The server stores ciphertext tied to the variable's name and scope, and cannot open it. Values saved before you had a vault stay encrypted with the server's key until the vault first opens, then move into it.",
		},
		directSends: {
			title: "Requests sent directly",
			detail:
				"Go from your browser to the API you call. The filled-in request and the response never reach {app}; history keeps only what its row says.",
		},
		proxySends: {
			title: "Requests sent through the proxy",
			detail:
				"When the browser cannot send a request as written (a header it refuses, an API without CORS) or you choose the proxy, the {app} server sends it for you and passes the response back, storing neither. A request to an app on your machine also goes through its Tunelo tunnel, whose web server logs the path and query.",
		},
		agentCopies: {
			title: "Secrets you let agents use",
			detail:
				"Only for variables where you turn on “Let agents use”: a copy encrypted with the server's key, filled in only for requests to the hosts you list. {app} never shows it to the agent and masks it in the answers; a value shorter than 4 characters, or one the API changes before echoing it, can get through.",
		},
		sharedSecrets: {
			title: "Shared values of secret variables",
			detail:
				"Of environments and globals: encrypted with the server's key so the people you share them with can use them, and never sent to Viewers.",
		},
		collectionSecrets: {
			title: "Secret variables of collections",
			detail:
				"Stored as they are and sent to everyone who can open the collection; the app only hides them on screen and leaves them out of exports, public links and agents.",
		},
		variables: {
			title: "Other variables",
			detail: "Stored as you set them, in your workspaces.",
		},
		collections: {
			title: "Collections, requests and examples",
			detail: "Stored so you can open them anywhere and share them.",
		},
		requestTabs: {
			title: "Open request tabs",
			detail:
				"Saved as you write them, <code>{token}</code> left unfilled; a credential typed in as is, rather than through a variable, is saved as typed.",
		},
		history: {
			title: "Request history",
			detail:
				"Each request as written, <code>{token}</code> left unfilled and credentials typed in as is blanked, with the status, time and size of its response and, after a redirect of a URL written without variables, where it ended without its query; never the response's headers or body.",
		},
		mockLogs: {
			title: "Mock request logs",
			detail:
				"Requests to your mock APIs and their responses, with query, headers and bodies; Authorization, Cookie, Set-Cookie and X-API-Key headers, and the headers you choose to hide, are stored as “[redacted]”.",
		},
		backups: {
			title: "Nightly backups",
			detail:
				"Of the whole database, on the same server: deleted data can remain in one until it is rotated out.",
		},
	},
	fieldLine: "<code>{field}</code>: {label}",
	proxyLog: {
		title: "What the proxy logs",
		body: "One line per request, with these fields only. Never the path, the query, headers or bodies.",
		fields: {
			sub: "your account ID",
			host: "the destination host, the secrets in it and a mock API's secret label masked",
			method: "the method",
			status: "the response status",
			error: "or the error code",
			ms: "the time it took",
			via: "the tunnel a local target went through",
		},
	},
	serverLog: {
		title: "What the server logs",
		body: "One line per request to {app}, with these fields only. Never headers, cookies, bodies or query strings. When something fails on the server, a line with the error is added.",
		fields: {
			requestId: "an ID to find the line again",
			method: "the method",
			route:
				"the route as its template; for a mock API, its path with the project's secret masked",
			status: "the response status",
			ms: "the time it took",
			projectId: "the mock project, when the request is about one",
			aborted: "set when the client hung up",
		},
	},
	webServerLog: {
		title: "What the web server logs",
		body: "The web server in front of {app} writes one line per request, with these fields only. Never the host name, the query, cookies or the page you came from.",
		fields: {
			ip: "your IP address",
			time: "the time",
			method: "the method",
			path: "the path, query hidden",
			status: "the response status",
			bytes: "the size of the response",
			userAgent: "your browser's name and version",
			duration: "the time it took",
		},
	},
	telemetry: {
		title: "Telemetry",
		body: "None. {app} uses no analytics, tracking or error reporting service, and shows no ads.",
	},
	more: "The <privacy>privacy policy</privacy> covers your account, signing in and the other services involved.",
	landing: {
		eyebrow: "Privacy",
		title: "Secrets never leave the browser",
		lead: "Your own values of secret variables are encrypted in your browser with a passphrase only you know, and requests go straight from your browser whenever it can send them. If {app} would switch a request carrying a secret to its proxy on its own, it asks you first.",
		points: {
			sealed: "The server keeps only ciphertext it cannot open.",
			direct: "Direct requests never touch a {app} server.",
			agents:
				"Agents use a secret only where you allow it; {app} never shows it to them.",
		},
		link: "Where your data lives",
	},
} as const;
