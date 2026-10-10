/** Plan cards, the "Manage plan" dialog, quota meters and the Pro interest form. */
export const subscription = {
	/** What a plan includes (plan cards on the landing and in the dialog). */
	plan: {
		projects: { one: "{count} project", other: "{count} projects" },
		resources: {
			one: "{count} resource per project",
			other: "{count} resources per project",
		},
		customResponse: "Custom responses and object templates",
		members: {
			one: "Up to {count} member per project, including you",
			other: "Up to {count} members per project, including you",
		},
		mockRequests: {
			one: "{count} mock request per month",
			other: "{count} mock requests per month",
		},
		mockRequestsUnlimited: "Unlimited mock requests per month",
		proxyRequests: {
			one: "{count} proxy request per month",
			other: "{count} proxy requests per month",
		},
		proxyRequestsUnlimited: "Unlimited proxy requests per month",
		notIncluded: "Not included:",
	},
	manage: {
		title: "Manage plan",
		currentBadge: "Current plan",
		seePricing: "See pricing",
		reachedTitle: "You've reached the {plan} plan limit: {limit}",
		reachedText: "Compare the two plans below.",
		current: "Current plan: <b>{plan}</b>. Each plan's limits are below.",
		proLead: "Higher limits and more members for projects in real use.",
		/** The quota that was hit, inside `reachedTitle`. */
		limit: {
			projects: { one: "{count} project", other: "{count} projects" },
			resources: { one: "{count} resource", other: "{count} resources" },
			members: {
				one: "{count} member per project",
				other: "{count} members per project",
			},
			proxy: {
				one: "{count} proxy request per month",
				other: "{count} proxy requests per month",
			},
			proxyAny: "proxy requests",
		},
	},
	usage: {
		unlimited:
			"<b>Unlimited</b> this month, with only a per-second rate limit.",
		valueText: "{used} of {max}",
		reached: "Limit reached.",
		usedPercent: "{percent}% used.",
	},
	proInterest: {
		title: "Contact us about Pro",
		submit: "Send request",
		successTitle: "Got it",
		successText: "We'll contact you at the email you left: <b>{email}</b>.",
		intro:
			"Payment for the Pro plan isn't open yet. Tell us what you need and we'll contact you when Pro is ready.",
		formFailed: "Couldn't open the form",
		preparingCheck: "Preparing the verification step…",
		turnstileFailed:
			"Couldn't load the verification step. Check your connection, then reopen the form.",
		fields: {
			email: "Email",
			emailHintPrefilled: "Taken from your account. You can change it.",
			emailHint: "Only used to contact you about the Pro plan.",
			name: "Name",
			needs: "What do you need the Pro plan for?",
			needsHint: "Choose one or more",
			team: "Team size",
			price: "Price you'd be willing to pay",
			note: "Note",
			notePlaceholder:
				"For example: our QA team needs 30 projects and runs CI every hour",
			honeypot: "Leave this field empty",
			consent:
				"I agree that Localman may store my email to contact me about the Pro plan",
		},
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
		/** Field checks before sending. */
		errors: {
			emailEmpty: "Enter your email so we can contact you.",
			emailInvalid: "That email doesn't look right.",
			name: "Enter your name so we know how to address you.",
			needs: "Choose at least one option.",
			teamSize: "Choose your team size.",
			note: "The note is too long. Please shorten it.",
			consent: "We need your consent to store your email and contact you.",
			turnstile: "Complete the verification before sending.",
		},
		/** Refusals of the API, by error code. */
		submitErrors: {
			validation: "Some details aren't valid. Check the fields and send again.",
			turnstileFailed: "Verification failed. Please try again.",
			turnstileUnavailable:
				"We can't check the verification step right now. Try again in a few minutes.",
			rateLimited:
				"You've sent this too many times. Wait a moment and try again.",
		},
	},
} as const;
