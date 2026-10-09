/** `/account`: plan summary and this month's quota meters. */
export const account = {
	title: "Account",
	plan: {
		name: "{plan} plan",
		nameExpires: "{plan} plan · expires {date}",
		limits: "{projects}, {resources}, {members}.",
		projects: { one: "{count} project", other: "{count} projects" },
		resources: {
			one: "{count} resource per project",
			other: "{count} resources per project",
		},
		members: {
			one: "up to {count} member per project",
			other: "up to {count} members per project",
		},
		notificationChannels: "Notification channels",
		manage: "Manage plan",
	},
	usage: {
		loading: "Loading quotas…",
		loadFailed: "Couldn't load your quotas",
	},
	meters: {
		projects: "Projects",
		projectsNote: "Counts projects you own, not projects you were invited to.",
		mockRequests: "Mock requests this month",
		mockNote: "Counts every REST request to the mock. Resets on {date}.",
		mockNoteMcp: "REST and MCP both count. Resets on {date}.",
		proxyRequests: "Proxy requests this month",
		proxyNote:
			"Requests sent from the API client, including through Tunelo. Resets on {date}.",
	},
} as const;
