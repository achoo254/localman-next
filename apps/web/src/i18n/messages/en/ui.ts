/** Shared UI primitives: copy buttons, toasts. */
export const ui = {
	codeBlock: {
		copy: "Copy {caption} code",
		copiedNote: "Code copied",
		failedNote:
			"Couldn't copy. The code is selected so you can copy it yourself.",
	},
	copyField: {
		defaultItem: "link",
		copy: "Copy {item}",
		copiedNote: "Copied {item}",
		autoFailedNote: "Press the copy button to copy the {item}.",
		failedNote: "Couldn't copy. Select the {item} and copy it yourself.",
	},
	toast: {
		region: "Notifications",
		close: "Close notification",
	},
} as const;
