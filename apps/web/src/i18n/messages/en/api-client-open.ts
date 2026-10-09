/** Opening mock project requests in the API client. */
export const apiClientOpen = {
	node: {
		label: "API Client",
		aria: "Open {name} in API Client",
	},
	project: {
		open: "Open in API Client",
	},
	fromMock: {
		button: "From mock project",
		title: "Open a mock project",
		intro:
			"Each enabled endpoint of every resource opens as a tab: list, get, create, update and delete, nested resources included. Record ids become variables such as <code>{example}</code>.",
		legend: "Mock project",
		loading: "Loading projects…",
		loadFailed: "We couldn't load your projects.",
		empty: "You have no mock project yet. Create one under Projects first.",
		submit: "Open requests",
	},
	names: {
		list: "List {name}",
		get: "Get one of {name}",
		create: "Create in {name}",
		update: "Replace in {name}",
		patch: "Update in {name}",
		delete: "Delete from {name}",
	},
	toast: {
		loadFailed: "Couldn't open the mock project",
		resourceMissing:
			"This resource is no longer in the project. Reload the project page and try again.",
		noEndpoints: "This project has no enabled endpoint yet.",
		truncated: "Opened {opened} of {total} requests",
		truncatedBody:
			"Up to {max} tabs can stay open. Close some tabs, then open the project again for the rest.",
		full: "No tab left to open",
		fullBody: "Up to {max} tabs can stay open. Close some tabs first.",
	},
} as const;
