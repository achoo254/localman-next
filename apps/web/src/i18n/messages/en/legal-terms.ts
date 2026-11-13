/**
 * `/terms`. Format and tags as in `legal.ts`; every claim and its source
 * (or "owner decision") is listed in `docs/legal-pages-review.md`.
 */
export const legalTerms = {
	title: "Terms of Use",
	intro:
		"By using Localman (the web app at {appHost}, its mock APIs and its MCP endpoints) you accept these terms and the <privacy>Privacy Policy</privacy>.",
	account: {
		title: "Your account",
		body: "You sign in with your {idpName} account; Localman keeps no password. Keep that account safe: whoever signs in with it can use your Localman data, and AI agents you authorize through it act with your access.",
	},
	limits: {
		title: "Limits",
		body: "Localman is free to use, and every account has the same limits; there are no paid plans. Your limits and this month's usage are shown on the Account page. Over a limit, nothing is deleted: only new items above it are refused. Limits may change.",
	},
	content: {
		title: "Your content",
		body: "You keep every right to what you create. You let Localman store and process it only to run the features you use, as the Privacy Policy describes.",
	},
	sharing: {
		title: "What you share",
		body: "- Anyone who knows a project's mock URL can call its mock API, including members you removed. Rotate the URL in the project to cut off old copies.\n- Anyone with a public link of a collection can read it; secret variable values are left out.\n- People you invite to a project or workspace see and change its content according to their role.",
	},
	use: {
		title: "Fair use",
		body: "Localman applies rate limits and usage limits, and refuses to send requests to private networks and mail ports. Do not try to get around them, overload the service, or use it to attack or reach systems you are not allowed to reach.",
	},
	cleanup: {
		title: "Inactive and deleted data",
		body: "Projects with no activity for 90 days may be deleted. Deleted collections stay in the trash for 30 days, then are deleted for good. Request logs and history expire as the Privacy Policy says.",
	},
	service: {
		title: "The service",
		body: "Localman may change, be interrupted or stop, and features may be turned off.",
	},
	end: {
		title: "Ending",
		body: "You can delete your account at any time at <idpDelete>your {idpName} account page</idpDelete>, which also deletes your Localman data (<accountDelete>what is deleted</accountDelete>). We may block an account that breaks these terms.",
	},
	changes: {
		title: "Changes",
		body: "When these terms change, the date at the top changes with them.",
	},
} as const;
