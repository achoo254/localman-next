/** Errors a send of the API client stops on before the network. */
export const apiClientSend = {
	preScriptFailed: "Not sent: the pre-request script stopped. {reason}",
	secretLocked:
		"Not sent: it uses {name}, whose value is locked in your secret vault. Unlock the vault with the lock button, then send again.",
	secretUnreadable:
		"Not sent: it uses {name}, whose local value was sealed by another secret vault and cannot be opened. Replace or remove that value, then send again.",
	secretWithheld:
		"Not sent: it uses {name}, a secret only Editors can see. Set your own local value for it in the environment, then send again.",
	scopesDropped:
		"Your scripts set {scopes} values, but there was nowhere to keep them: no active environment, or a request outside any collection.",
	scopeNames: { environment: "environment", collectionVariables: "collection" },
	scopesWithheld:
		"Not saved: {names} would hold the value of a secret from your vault in plain text. Make it a secret variable, or use the secret through its own variable.",
	scopesNotSaved:
		"The response came back, but the variables your scripts set could not be saved. Send again to retry.",
	dynamicVariablesUnavailable:
		"Not sent: couldn't load the random values ($random…). Check your connection and try again.",
	variablesUnavailable:
		"Not sent: we couldn't load your environment variables. Check your connection and try again.",
	sourceFailed:
		"Not sent: a request this one needs a response from did not get one.",
	references: {
		REFERENCE_OUTSIDE_COLLECTION:
			"Not sent: a response reference only works in a request saved in a collection.",
		REFERENCE_REQUEST_NOT_FOUND:
			"Not sent: no request named “{name}” in this collection for a response reference.",
		REFERENCE_LOOP:
			"Not sent: “{name}” needs a response of the request being sent, which loops.",
		REFERENCE_TOO_DEEP:
			"Not sent: a response reference chains through too many requests (at most 5).",
		REFERENCE_SEND_FAILED:
			"Not sent: the request {name} that a response reference needs did not get a response.",
		REFERENCE_NOT_JSON:
			"Not sent: the response of “{name}” is not JSON, so {path} can't be read.",
		REFERENCE_PATH_INVALID:
			"Not sent: {path} is not a JSONPath like $.token or $.items[0].id.",
		REFERENCE_PATH_MISSING:
			"Not sent: the response of “{name}” has nothing at {path}.",
	},
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
