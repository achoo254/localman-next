/**
 * A limit reached while creating something, and the account's usage
 * meters. Every account has the same limits; no plan or price wording.
 */
export const limits = {
	reached: {
		projects: {
			one: "You've reached the limit of {count} project on this account. Delete one to create another.",
			other:
				"You've reached the limit of {count} projects on this account. Delete one to create another.",
		},
		resources: {
			one: "Your projects have reached their limit of {count} resource in total. Delete one to add another.",
			other:
				"Your projects have reached their limit of {count} resources in total. Delete one to add another.",
		},
		webhookInboxes: {
			one: "This project has reached its limit of {count} inbox. Delete one to add another.",
			other:
				"This project has reached its limit of {count} inboxes. Delete one to add another.",
		},
		teamWorkspaces: "This account can't create more team workspaces.",
	},
	feedback: "Need more? Tell us with the feedback form.",
	usage: {
		unlimited:
			"<b>Unlimited</b> this month, with only a per-second rate limit.",
		valueText: "{used} of {max}",
		reached: "Limit reached.",
		usedPercent: "{percent}% used.",
	},
} as const;
