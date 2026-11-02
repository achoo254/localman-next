/** Owner-only admin page: the feedback inbox. */
export const admin = {
	heading: "Admin · {page}",
	ownerOnly: "Owner only",
	nav: {
		feedback: "Feedback inbox",
	},
	forbidden: {
		title: "403 · Only the owner can see this page",
		body: "The admin pages are for the people who run Localman.",
		back: "Back to Projects",
	},
	pagination: {
		label: "Pagination",
		previous: "Previous page",
		next: "Next page",
	},
	status: "Status",
	deletePermanently: "Delete permanently",
	inbox: {
		category: "Type",
		statuses: { new: "New", read: "Read", resolved: "Resolved" },
		sources: {
			landing: "Home page",
			projects: "Projects",
			apiClient: "API client",
			account: "Account",
			admin: "Admin",
			invite: "Invitation",
			docs: "Docs",
			elsewhere: "Other",
		},
		actions: {
			markRead: "Mark as read",
			markResolved: "Mark as resolved",
			markUnread: "Mark as unread",
			reopen: "Reopen",
		},
		user: "User",
		visitor: "Visitor",
		signedIn: "Signed in",
		noContact: "No contact left",
		count: { one: "{count} message", other: "{count} messages" },
		loading: "Loading the inbox…",
		empty: "No messages match the filters.",
		statusChanged: "Moved to “{status}”.",
		deleted: "Message deleted.",
		deleteTitle: "Delete message",
		deleteQuestion: "Delete the message from {sender}?",
		deleteBody:
			"The text, name and contact address of this message are deleted for good. This can't be undone.",
	},
} as const;
