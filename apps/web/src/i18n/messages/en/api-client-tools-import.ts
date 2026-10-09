/** Import dialog and export menu of the API client. */
export const apiClientToolsImport = {
	title: "Import",
	intro:
		"Paste a cURL command, a Collection v2.1, an environment file (v2.1) or an OpenAPI 3.x document in JSON, or choose a file.",
	text: "Content to import",
	placeholder: "curl -X GET 'https://api.example.com/users'",
	chooseFile: "Choose file",
	fileChosen: "{name} ({size})",
	removeFile: "Remove {name}",
	reading: "Reading the file…",
	readFailed: "Couldn't read the file. Choose it again.",
	idle: "Nothing to import yet.",
	detecting: "Checking the format…",
	detected: {
		one: "Detected {format}: {count} request.",
		other: "Detected {format}: {count} requests.",
	},
	detectedEnvironment: {
		one: "Detected an environment file: {count} variable.",
		other: "Detected an environment file: {count} variables.",
	},
	formats: {
		curl: "cURL",
		"collection-v21": "Collection v2.1",
		openapi: "OpenAPI 3.x",
	},
	errors: {
		INPUT_TOO_LARGE:
			"The content is larger than {max}. Split it into smaller files.",
		EMPTY_INPUT: "There's nothing to import. Paste content or choose a file.",
		INVALID_JSON:
			"This isn't valid JSON or a cURL command. Check the content and try again.",
		YAML_NOT_SUPPORTED:
			"YAML isn't supported yet. Convert the document to JSON, then import it.",
		UNKNOWN_FORMAT:
			"The format wasn't recognised. Use cURL, Collection v2.1, an environment file or OpenAPI 3.x JSON.",
		UNSUPPORTED_VERSION:
			"{version} isn't supported. Use Collection v2.1 or OpenAPI 3.x.",
		INVALID_CURL: "This cURL command has no URL to request.",
		UNTERMINATED_QUOTE:
			"A quote in the cURL command is never closed. Check the quotes and try again.",
		INVALID_DOCUMENT:
			"The document is malformed at {path}. Check the file and try again.",
		TOO_COMPLEX: "The document is nested too deeply or is too large to import.",
	},
	warningsTitle: {
		one: "{count} note about this import",
		other: "{count} notes about this import",
	},
	warnings: {
		UNSUPPORTED_OPTION:
			"cURL option {option} has no equivalent and was ignored.",
		UNSUPPORTED_AUTH: "Auth type {type} isn't supported; set to no auth.",
		UNSUPPORTED_BODY: "Body type {mode} isn't supported; left empty.",
		UNSUPPORTED_METHOD: "Method {method} isn't supported; GET is used.",
		FILE_NOT_INCLUDED: "File {name} isn't part of the import. Pick it again.",
		SCRIPT_REVIEW:
			"A script uses another tool's API. Scripts here use <code>lm.*</code>; review it.",
		TRUNCATED: "Only the first {max} items were imported.",
		EXTRA_URLS: "The command names {count} more URLs; only the first is used.",
		UNRESOLVED_REF: "Reference {ref} couldn't be resolved and was skipped.",
		MORE_WARNINGS: "{count} more notes are not listed.",
	},
	picker: {
		legend: "Requests to open",
		selectAll: "Select all",
		selectNone: "Select none",
		selected: "{count} of {total} selected",
		capped: "You can open at most {max} tabs at once.",
	},
	submitRequests: {
		one: "Open {count} request",
		other: "Open {count} requests",
	},
	submitEnvironment: "Import environment",
	export: {
		trigger: "Export",
		label: "Export the open requests",
		collection: "Collection v2.1 (.json)",
		openapi: "OpenAPI 3.0 (.json)",
		environment: "Environment (.json)",
		downloaded: "Downloaded {file}.",
		skipped: {
			one: "{count} request was left out: another one has the same method and path.",
			other:
				"{count} requests were left out: others have the same method and path.",
		},
		secretsBlank: "Secret values are left empty in the file.",
		nothing: "Open a request to export it.",
		defaultName: "Localman requests",
	},
} as const;
