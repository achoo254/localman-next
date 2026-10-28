/** Top bars, account menu, footer, skip link and theme switch. */
export const layout = {
	skipLink: "Skip to content",
	pageLoading: "Loading page…",
	docs: "Docs",
	projects: "Projects",
	home: "Localman home",
	publicHeader: {
		features: "Features",
	},
	appHeader: {
		home: "Localman, go to Projects",
		nav: "Products",
		mocks: "Mock API",
	},
	accountMenu: {
		trigger: "{name} · Account",
		account: "Account and limits",
		notifications: "Notification channels",
		adminProInterest: "Admin · Pro interest",
		adminFeedback: "Admin · Feedback inbox",
		signOut: "Sign out",
	},
	idpMenu: {
		heading: "{idpName} account · opens in a new tab",
		email: "Email",
		signIn: "Sign-in methods",
		apps: "Authorized apps",
		opensIdp: ", opens your {idpName} account in a new tab",
	},
	footer: {
		ecosystem: "An app from {domain}",
		feedback: "Feedback / Contact",
	},
} as const;
