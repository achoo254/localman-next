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
		openApp: "Open app",
		reset: "Reset",
		retry: "Try again",
	},
	opensInNewTab: "(opens in a new tab)",
	actions: {
		cancel: "Cancel",
		close: "Close",
		delete: "Delete",
		save: "Save",
		send: "Send",
		sending: "Sending…",
		copied: "Copied",
	},
	loading: "Loading…",
	optional: "(optional)",
	all: "All",
	errors: {
		server: "Something went wrong on the server. Try again later.",
		network: "Couldn't connect to the server.",
		rateLimited: "You're going too fast. Wait about a minute and try again.",
		invalidJson: "Invalid JSON.",
		invalidJsonAt: "Invalid JSON at line {line}, column {column}.",
	},
} as const;
