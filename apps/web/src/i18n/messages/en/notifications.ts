/** Header bell and `/account/notifications` (`features/notifications`). */
export const notifications = {
	bell: {
		label: "Notifications",
		labelUnread: "Notifications, {unread} unread",
		heading: "Notifications",
		markAllRead: "Mark all as read",
		loadFailed: "Couldn't load notifications.",
		loading: "Loading…",
		empty: "No notifications yet.",
		loadMore: "Show more",
		settings: "Notification channel settings",
		unread: "Unread:",
	},
	settings: {
		title: "Notification channels",
		lead: "Choose where to get notifications for each event type: the in-app bell, Web Push or Telegram.",
		loading: "Loading settings…",
		loadFailed: "Couldn't load notification settings",
		channelsTitle: "Delivery channels",
		inAppText:
			"The bell in Localman. Choose it per event type in the table below.",
	},
	test: {
		title: "Test notification",
		text: "Send a test to every channel that's ready, whatever you chose per event type below.",
		send: "Send test notification",
		resultTitle: "Test notification results",
		rateLimited:
			"You sent a test less than a minute ago. Wait a minute and try again.",
		status: {
			sent: "Sent",
			notSetUp: "Not set up",
			unavailable: "Not on this server",
			failed: "Failed",
			blocked: "Bot not started",
		},
		inAppHint: "Open the bell at the top to see it.",
		failedHint: "Couldn't deliver it. Try again later.",
		blockedWithBot: "Open <bot></bot> and press Start, then send another test.",
		blockedNoBot:
			"Open Localman's Telegram bot and press Start, then send another test.",
	},
	channels: {
		inApp: "In app",
		webPush: "Web Push",
		telegram: "Telegram",
	},
	events: {
		title: "Notifications by event type",
		empty: "No event types yet.",
		event: "Event",
		cell: "{event}: {channel}",
		note: "Each box saves as soon as you change it. A box is locked when its channel isn't ready. There's no email channel: {idpName} doesn't send email.",
		/** Event types by API `type` ("project.invitation" → projectInvitation). */
		types: {
			projectInvitation: "Project collaboration invitations",
			projectMockUrlChanged: "A shared project's mock URL changed",
			usageQuota: "Monthly mock request quota warnings",
			workspaceInvitation: "Workspace invitations",
			elementShared: "Collections and environments shared with you",
			accessRequested: "Requests for access to your items",
			accessResolved: "Answers to your access requests",
		},
	},
	webPush: {
		checking: "Checking your browser…",
		unsupported: "This browser doesn't support Web Push.",
		unavailable: "Web Push isn't enabled on the server.",
		denied: "Your browser is blocking it. Open the site settings to allow it.",
		on: "On in this browser.",
		elsewhere: "On for another device, not in this browser yet.",
		off: "Off.",
		blocked: "Your browser is blocking Localman's notifications.",
		notAllowed: "You haven't allowed notifications.",
		turnedOff: "Turned off Web Push in this browser.",
		turnedOn: "Turned on Web Push in this browser.",
		disable: "Turn off Web Push",
		enable: "Turn on Web Push",
	},
	telegram: {
		unavailable: "Telegram isn't enabled on the server.",
		notLinked:
			"Not linked. Link it in your {idpName} account; the link is shared by Localman and Tunelo.",
		linked: "Linked.",
		linkedAs: "Linked as @{username}.",
		linkedInactive: "Linked, bot not started yet.",
		linkedAsInactive: "Linked as @{username}, bot not started yet.",
		manage: "Manage",
		link: "Link Telegram",
		startTitle: "Start the Telegram bot",
		startWithBot:
			"Open <bot></bot> and press Start so Localman can send you notifications.",
		startNoBot:
			"Open Localman's Telegram bot and press Start to get notifications.",
	},
} as const;
