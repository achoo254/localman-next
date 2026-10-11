/** Examples and multi-select of the collections tree. */
export const collectionsExamples = {
	example: {
		response: "Response",
		status: "Status",
		statusInvalid: "Use a status from 100 to 599.",
		statusText: "Status text",
		language: "Body language",
		headers: "Response headers",
		addHeader: "Add header",
		body: "Response body",
		note: "An example is a saved response of this request. It documents the request; sending does not use it.",
		gone: "This example no longer exists. Close its tab.",
		cut: "The body was too long, so it was cut to fit before saving.",
		saveFromResponse: "Save as example",
		saved: "Saved the example {name}.",
	},
	bulk: {
		selected: {
			one: "{count} selected",
			other: "{count} selected",
		},
		clear: "Clear",
		delete: "Delete",
		bar: "Selected items",
		title: "Delete the selected items",
		collections: {
			one: "{count} collection moves to the Trash.",
			other: "{count} collections move to the Trash.",
		},
		nodes: {
			one: "{count} folder, request or example is deleted for good.",
			other: "{count} folders, requests or examples are deleted for good.",
		},
		confirm: "Delete",
		done: {
			one: "Deleted {count} item.",
			other: "Deleted {count} items.",
		},
		partial: "Deleted {done} of {total} items. {reason}",
	},
} as const;
