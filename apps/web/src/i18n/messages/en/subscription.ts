/** Quota meters, and the answers of past Pro interest requests (admin page). */
export const subscription = {
	usage: {
		unlimited:
			"<b>Unlimited</b> this month, with only a per-second rate limit.",
		valueText: "{used} of {max}",
		reached: "Limit reached.",
		usedPercent: "{percent}% used.",
	},
	proInterest: {
		needs: {
			mock: "Mock API",
			apiClient: "API client",
			team: "Team",
			devopsCi: "DevOps/CI",
			mcp: "MCP",
			tunelo: "Tunelo",
		},
		teamSizes: {
			solo: "Just me",
			small: "2–5",
			medium: "6–20",
			large: "More than 20",
		},
		priceHints: {
			unsure: "Not sure",
			lt100: "Under 100,000 VND per month",
			from100to250: "100,000–250,000 VND per month",
			from250to500: "250,000–500,000 VND per month",
			gt500: "Over 500,000 VND per month",
		},
		/** Where the form was opened from (admin page). */
		sources: {
			landing: "Landing · Pro card",
			pricing: "Pricing",
			subscriptionModal: "Manage plan",
			planLimitProjects: "Project limit",
			planLimitResources: "Resource limit",
			planLimitMembers: "Member limit",
			planLimitProxy: "Proxy quota used up",
			devops: "DevOps",
			account: "Account",
			elsewhere: "Other",
		},
	},
} as const;
