/**
 * `/account`: this month's quota meters and where the account is deleted.
 */
export const account = {
	title: "Account",
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
	delete: {
		body: "Your account, with its data in Localman and every other app that uses it, is deleted at {idpName}.",
		link: "Delete account at {idpName}",
	},
} as const;
