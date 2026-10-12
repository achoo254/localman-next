/** `/account`: until when the extended limits last and this month's quota meters. */
export const account = {
	title: "Account",
	limitsUntil: "Your extended limits last until {date}.",
	notificationChannels: "Notification channels",
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
