/** Upstream of the hybrid mock and the headers masked in the request log. */
export const upstream = {
	tab: "Upstream",
	title: "Upstream for routes the mock doesn't have",
	intro:
		"Routes that match a resource or an enabled endpoint are answered by the mock; every other route is forwarded to the upstream with its method, headers and body. Your frontend needs one base URL: <code>{baseUrl}</code>. Responses carry <code>X-Localman-Source: mock</code> or <code>upstream</code>.",
	readonly:
		"You're viewing as a collaborator. Only the project owner can change the upstream and the masked headers.",
	loading: "Loading the upstream…",
	loadFailed: "Couldn't load the upstream settings. Try again.",
	legend: "Choose an upstream",
	options: {
		none: {
			title: "none",
			help: "No forwarding: unmatched routes return 404.",
		},
		tunnel: {
			title: "tunnel:<port>",
			help: "A backend on your machine, through your own Tunelo tunnel.",
		},
		url: {
			title: "URL",
			help: "A deployed backend, such as staging. Public https only.",
		},
	},
	port: {
		label: "Port",
		error: "Port must be between 1 and 65535.",
	},
	unavailableNote:
		"If the tunnel stops, forwarded routes get <code>502 UPSTREAM_UNAVAILABLE</code> with a command hint.",
	url: {
		label: "Upstream URL",
		invalid: "Enter a public https URL, such as https://staging.example.com.",
		blocked:
			"This address points to a private network, so Localman can't forward to it.",
	},
	save: "Save upstream",
	saved:
		"Upstream set to <code>{label}</code>. Routes the mock doesn't have now go there.",
	saveFailed: "Couldn't save the upstream",
	current: "In use: <code>{label}</code>",
	quotaNote:
		"Every request to the mock counts toward your mock request quota, forwarded ones included.",
	tunnel: {
		mapped: "Mapped: <code>localhost:{port}</code> → <code>{url}</code>",
		missing:
			"No mapping for <code>localhost:{port}</code>. Run <code>tunelo http {port}</code>, then map it in <link>Tunelo in the API client</link>.",
		unchecked:
			"Save to check the tunnel of <code>localhost:{port}</code>. To open one, run <code>tunelo http {port}</code>, then map it in <link>Tunelo in the API client</link>.",
		copy: "Copy command",
		copyFailed: "Couldn't copy. Copy it by hand: {command}",
	},
	masked: {
		title: "Masked headers",
		intro:
			"These headers are stored as <code>[redacted]</code> in the request log. A change applies to requests logged from now on.",
		always: "Always masked",
		custom: "Also masked in this project",
		none: "No extra headers yet.",
		inputLabel: "Header name",
		add: "Add header",
		remove: "Stop masking {name}",
		invalid: "Enter a header name, such as x-session-token.",
		duplicate: "This header is already masked.",
		max: "Up to {max} extra headers per project.",
		saved: "Saved the masked headers.",
		saveFailed: "Couldn't save the masked headers",
	},
} as const;
