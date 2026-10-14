import { publicSharingShare } from "./public-sharing-share";
import { publicSharingView } from "./public-sharing-view";

/**
 * Public sharing of collections: public and guest links, access keys,
 * Run buttons, the read-only pages they open and the workspace switches.
 */
export const publicSharing = {
	errors: {
		forbidden:
			"Only Admins and Editors of the workspace can publish this collection.",
		publicLinksDisabled:
			"Public links are turned off for this workspace. An Admin can turn them on in workspace settings.",
		guestsDisabled:
			"Guest links are turned off for this workspace. An Admin can turn them on in workspace settings.",
		accessKeysDisabled:
			"Access keys are turned off for this workspace. An Admin can turn them on in workspace settings.",
		accessKeyLimit:
			"You already have the most access keys allowed for this collection. Revoke one to create another.",
		runButtonLimit:
			"This collection already has the most Run buttons allowed. Delete one to create another.",
		environmentNotInWorkspace:
			"That environment isn't in this collection's workspace. Pick another one.",
		linkNotFound: "This link does not exist or was turned off.",
		runButtonNotFound: "This Run button does not exist or was deleted.",
		rateLimited: "Too many requests. Wait a minute, then try again.",
		collectionLimit:
			"That workspace already has as many collections as it can hold. Pick another workspace or delete a collection.",
		collectionTooLarge: "This collection is too large to import.",
		importInProgress:
			"This import is already running. Wait a moment, then try again.",
		workspaceUnavailable:
			"You can't add collections to that workspace. Pick another one.",
		invalid: "Check the values you entered, then try again.",
		notFound: "It no longer exists.",
		fallback: "Something went wrong. Try again.",
	},
	warning: {
		none: "No values that look like secrets were found.",
		found: {
			one: "{count} value looks like a secret",
			other: "{count} values look like secrets",
		},
		foundText:
			"Check these places. Their values are published unless you move them into secret variables.",
		plainNote:
			"Secret variables and credentials in Authorization tabs are hidden. Plain variables are published as they are, and so are bodies, scripts and URLs.",
		root: "Collection",
		list: "Places with secret-looking values",
		places: {
			collectionVariable: "Collection variable",
			environmentVariable: "Environment variable",
			script: "Script",
			requestBody: "Request body",
			requestHeader: "Request header",
			exampleHeader: "Example header",
			url: "URL",
		},
	},
	share: publicSharingShare,
	view: publicSharingView,
} as const;
