/** Tunelo in the API client: tunnels to local targets, set by hand. */
export const apiClientTunelo = {
	rail: "Tunelo",
	title: "Tunelo",
	intro:
		"Test an API on localhost from the browser: expose it with one Tunelo command, then map its local address to the tunnel URL here.",
	steps: {
		label: "Open a tunnel",
		install: "Install Tunelo (Node 20+)",
		login: "Sign in this device",
		http: "Open a tunnel for port {port}",
		tcpHint:
			"The API client sends HTTP only. For a TCP service, Tunelo has <code>tunelo tcp {port}</code>.",
	},
	warning: {
		title: "A tunnel opens your local service to the internet",
		body: "While it runs, anyone with the URL can call the app on your machine. Add <code>-a user:pass</code> for sensitive data, and press Ctrl+C to stop the tunnel when you are done.",
	},
	form: {
		title: "Map a local address",
		local: "Local address",
		localPlaceholder: "http://localhost:3000",
		tunnel: "Tunnel URL",
		tunnelPlaceholder: "https://name.{domain}",
		add: "Save mapping",
		invalidLocal:
			"Enter an address on your machine or network, for example http://localhost:3000.",
		invalidTunnel:
			"Paste the https URL Tunelo printed, for example https://name.{domain}.",
		noDomains:
			"No tunnel domain is set up on this server yet, so a tunnel URL can't be saved.",
		saved: "Requests to {key} now go through the tunnel.",
	},
	mappings: {
		title: "Mappings",
		hint: "Requests to a mapped local address go through its tunnel, path and query kept. Only you see your mappings.",
		empty: "No mapping yet.",
		loading: "Loading mappings…",
		use: "Use the tunnel for {key}",
		delete: "Delete the mapping of {key}",
	},
	panel: {
		title: "Send to your machine through Tunelo",
		reason: "The proxy can't call {key}",
		reasonBody:
			"The Localman proxy runs on a server, so it refuses localhost and LAN addresses. Open a tunnel with Tunelo and paste its URL below.",
		directFailed: "Tried to send directly to {key}",
		directFailedBody:
			"The browser refused: the dev server sends no CORS for this page, or local network access was denied.",
		recheck: "Send again",
		paste: "Or paste the tunnel URL",
		pasteSubmit: "Replace host and send again",
	},
	cors: {
		title: "Or enable CORS on your dev server",
		body: "Allow {origin} on the dev server to send directly: credentials then stay on your machine.",
		framework: "Framework",
	},
	badge: {
		label: "Via Tunelo",
		tip: "Sent to {url}",
		labelAuto: "Tunnel ready",
		tipAuto:
			"Auto sends straight from your browser when it can, and through {url} when it cannot. Choose Proxy to always use the tunnel.",
		labelDirect: "Tunnel not used",
		tipDirect:
			"Direct always sends from your browser. Choose Proxy or Auto to use {url}.",
		unmap: "Remove the mapping of {key}",
	},
} as const;
