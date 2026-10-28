/**
 * Public landing (`pages/landing`). `meta` is also the static copy of
 * `apps/web/index.html` (title, description) for crawlers.
 */
export const landing = {
	meta: {
		titleMock: "Localman · Stateful mock REST APIs with relations and Faker",
		titleLocalhost: "Localman · Test localhost APIs right in your browser",
		description:
			"Spin up a stateful mock REST API in minutes: declare resources, generate data with Faker.js, nest relations and get CRUD endpoints right away.",
	},
	hero: {
		badgeMock: "Mock REST API for developers",
		badgeLocalhost: "Localhost right in your browser",
		titleMock: "Stateful <code>mock</code> REST APIs with relations and Faker",
		titleLocalhost: "Test <code>localhost</code> APIs right in your browser",
		subMock:
			"Declare resources, generate fake data in one click and get full CRUD endpoints right away. Your frontend no longer waits for the backend.",
		subLocalhost:
			"<b>No app or extension to install, just one Tunelo command.</b> Run <code>tunelo http 3000</code> and Localman picks up the tunnel by port, then sends requests to <code>localhost</code> or machines on your LAN. Stateful mock REST APIs included, so the frontend never waits for the backend.",
		noteMock:
			"Sign in and start right away: {projects} projects, {resources} resources in total and custom responses included.",
		noteLocalhost:
			"Sign in and start right away: {projects} mock projects, {resources} resources in total and {proxy} proxy requests per month.",
	},
	preview: {
		viaTunelo: "via Tunelo",
		tunnelFound: "Tunnel on port 3000 detected",
		records: { one: "{count} record", other: "{count} records" },
	},
	liveSync: {
		title: "Change the mock, the collection follows",
		lead: "A stateful mock generates a collection with a ready-to-run environment and keeps them in sync. Rename a resource and the request paths follow; headers or bodies you edited stay as they are.",
		play: "Rename users → members",
		updated: {
			one: "{count} request updated",
			other: "{count} requests updated",
		},
		synced: "In sync",
		fields: "Fields:",
		collection: {
			one: "Collection · {count} request",
			other: "Collection · {count} requests",
		},
		headerKept:
			"The <code>X-Debug</code> header you added to “List {name}” is kept.",
	},
	mockMcp: {
		eyebrow: "Instant Mock MCP",
		title: "Your mock becomes a tool for AI agents",
		lead: "Every mock project comes with an MCP endpoint. Agents call <code>list_users</code> or <code>create_posts</code> on the mock's own stateful data, with no MCP server for you to write.",
		snippetHelp:
			"Streamable HTTP · shares its data with REST. Replace <code>a1b2c3d4</code> with your project's secret; the full command is in the project's MCP tab.",
		toolsTitle: "Tools generated from resources",
		toolsBadge: {
			one: "{count} tool per resource",
			other: "{count} tools per resource",
		},
		toolsHelp:
			"Nested resources like <code>posts</code> also take <code>parentId</code>. Records created over MCP show up in <code>GET /users</code> right away.",
	},
	modeling: {
		title: "Simple data modeling",
		lead: "Each resource is a table of fields. Pick a data type or a Faker.js method, and Localman generates data in that shape.",
		schemaLabel: "Schema of users",
		tableLabel: "Schema table, scrolls horizontally",
		fieldCount: { one: "{count} field", other: "{count} fields" },
		none: "None",
		previewLabel: "Sample data of users",
		sampleSource: "Sample data from Faker.js",
		reroll: "Show another sample",
	},
	relations: {
		eyebrow: "Relations",
		title: "Relations between resources",
		lead: "Nest resources to get endpoints like <code>/users/:userId/posts</code>. Try nesting <b>comments</b> into <b>posts</b> below.",
		tree: "Resource tree",
		nested: "Nested {child} into {parent}.",
		movedToRoot: "Moved {child} back to the root.",
		endpoints: "Generated endpoints",
		endpointCount: { one: "{count} endpoint", other: "{count} endpoints" },
		listLabel: "Endpoint list, scrolls vertically",
	},
	features: {
		eyebrow: "Features",
		title: "And more",
		comingSoon: "Coming soon",
		seeExample: "See example",
		pagination: {
			title: "Pagination",
			description: "Page through lists with a query string.",
		},
		sorting: {
			title: "Sorting",
			description: "Sort by any field, ascending or descending.",
		},
		filtering: {
			title: "Filtering",
			description: "Search across every field, or filter by one.",
		},
		generator: {
			title: "Data generation",
			description: "{methods} Faker.js methods, up to {max} records per click.",
		},
		customResponse: {
			title: "Custom responses",
			description:
				'Your own template per endpoint, with the <code>"$mockData"</code> and <code>"$count"</code> variables and Faker.js.',
		},
		collaboration: {
			title: "Collaboration",
			description:
				"Invite teammates by username, email or invite link to work on a project together.",
		},
		customEndpoints: {
			title: "Custom endpoints",
			description: "Define your own paths and methods beyond the default CRUD.",
		},
		webhooks: {
			title: "Webhooks",
			description: "Call your URL whenever the data changes.",
		},
	},
	perks: {
		free: "Free",
		ready: "Ready in a minute",
		inBrowser: "Runs in your browser",
	},
} as const;
