/** Top bars, account menu, footer, skip link and theme switch. */
export const layout = {
	skipLink: "Skip to content",
	pageLoading: "Loading page…",
	docs: "Docs",
	projects: "Projects",
	home: "Localman home",
	publicHeader: {
		home: "Localman, home",
		nav: "Main navigation",
		features: "Features",
		signIn: "Sign in",
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
		heading: "hoandat account · opens in a new tab",
		email: "Email",
		signIn: "Sign-in methods",
		apps: "Authorized apps",
		opensIdp: ", opens your hoandat account in a new tab",
	},
	footer: {
		copyright: "© {year} Localman",
		feedback: "Feedback / Contact",
	},
	theme: {
		legend: "Color mode",
		light: "Light theme",
		dark: "Dark theme",
		system: "Match system",
	},
} as const;
