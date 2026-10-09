/** Shared texts: the language switcher and calls to action used in many places. */
export const common = {
	language: {
		label: "Language",
		trigger: "Language: {language}",
		loadFailed:
			"Couldn't load this language. Check your connection and try again.",
		saveFailed:
			"Couldn't save the language to your account. It still applies in this browser.",
	},
	cta: {
		startFree: "Get started free",
		start: "Get started",
		contact: "Contact",
		reset: "Reset",
		retry: "Try again",
	},
	opensInNewTab: "(opens in a new tab)",
} as const;
