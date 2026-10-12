/** Errors a send of the API client stops on before the network. */
export const apiClientSend = {
	preScriptFailed: "Not sent: the pre-request script stopped. {reason}",
	secretWithheld:
		"Not sent: it uses {name}, a secret only Editors can see. Set your own local value for it in the environment, then send again.",
	scopesDropped:
		"Your scripts set {scopes} values, but there was nowhere to keep them: no active environment, or a request outside any collection.",
	scopeNames: { environment: "environment", collectionVariables: "collection" },
	scopesNotSaved:
		"The response came back, but the variables your scripts set could not be saved. Send again to retry.",
	dynamicVariablesUnavailable:
		"Not sent: couldn't load the random values ($random…). Check your connection and try again.",
	variablesUnavailable:
		"Not sent: we couldn't load your environment variables. Check your connection and try again.",
	fileUnreadable: "A file of the body could not be read. Choose it again.",
	prepare: {
		invalidUrl:
			"Enter a full http or https URL, for example https://api.example.com/users.",
		invalidHeaderName:
			"Header “{name}” has characters a header name can't have.",
		invalidHeaderValue: "The value of header “{name}” has a line break.",
		fileMissing:
			"Choose the file “{name}” again: files are not kept after a reload.",
		bodyTooLarge: "The body is over 10 MB, the most a request can carry.",
	},
	script: {
		SCRIPT_ERROR: "The script threw an error.",
		SCRIPT_TOO_LONG: "The script is too long.",
		SCRIPT_TIMEOUT: "The script ran for too long and was stopped.",
		SCRIPT_MEMORY_LIMIT: "The script used too much memory.",
		SCRIPT_STACK_OVERFLOW: "The script nested calls too deeply.",
		SCRIPT_UNAVAILABLE:
			"The script sandbox could not load. Check your connection and try again.",
		SCRIPT_INTERNAL: "The script sandbox failed. Try again.",
		atLine: "{reason} (line {line})",
	},
} as const;
