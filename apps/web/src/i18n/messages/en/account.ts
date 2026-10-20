/**
 * `/account`: until when the extended limits last, this month's quota
 * meters and deleting the account.
 */
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
	delete: {
		title: "Delete account",
		body: "Delete your Localman account and its data for good. Your {idpName} sign-in account is not affected.",
		learnMore: "What is deleted",
		open: "Delete account…",
		question: "Delete your Localman account?",
		loading: "Checking what will be deleted…",
		loadFailed: "Couldn't check what will be deleted",
		projects: {
			one: "{count} mock project you own, with its data",
			other: "{count} mock projects you own, with their data",
		},
		sharedProjects: {
			one: "{count} of them is shared with other people",
			other: "{count} of them are shared with other people",
		},
		projectMembers: {
			one: "{count} person who is a member of those projects loses access to them",
			other:
				"{count} people who are members of those projects lose access to them",
		},
		workspaces: {
			one: "{count} workspace: your personal one, or a team with no other member",
			other:
				"{count} workspaces: your personal one and teams with no other member",
		},
		collections: {
			one: "{count} collection in them, with its requests",
			other: "{count} collections in them, with their requests",
		},
		leftWorkspaces: {
			one: "You leave {count} team workspace; what you wrote there stays, without your name",
			other:
				"You leave {count} team workspaces; what you wrote there stays, without your name",
		},
		everythingElse:
			"Your history, open tabs, settings, notifications and every sign-in session are deleted too.",
		irreversible: "This can't be undone.",
		blocked:
			"You are the only Admin of these team workspaces, which have other members. Make another member Admin, or remove the other members, then try again:",
		idp: "Your {idpName} account stays. <idpDelete>Delete it at {idpName}</idpDelete> as well if you want.",
		confirmLabel: "Type your username <b>{username}</b> to confirm",
		confirm: "Delete account",
	},
} as const;
