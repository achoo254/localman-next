/** Code snippet dialog of the API client (`apiClientTools.snippet`). */
export const apiClientToolsSnippet = {
	title: "Code snippet",
	language: "Language",
	resolved:
		"Variables are filled in with their current values. Check the code before you share it.",
	secrets:
		"The code holds the value of secret variables {names} in plain text.",
	unresolved: "These variables have no value and stay as typed: {names}.",
	bodyOmitted:
		"The body is a file and isn't in the code. Attach it in your own code.",
	failed: "Couldn't generate code for this request.",
} as const;
