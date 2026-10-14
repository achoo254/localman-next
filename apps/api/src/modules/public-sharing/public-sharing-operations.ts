import type { AnyOperation } from "@localman/operations";
import { accessKeyOperations } from "./access-key-operations.js";
import {
	guestLinkOperations,
	viewGuestCollectionOperation,
} from "./guest-link-operations.js";
import {
	getPublicCollectionOperation,
	publicLinkOperations,
} from "./public-link-operations.js";
import {
	getRunButtonOperation,
	importRunButtonOperation,
} from "./run-button-client-operations.js";
import {
	createRunButtonOperation,
	deleteRunButtonOperation,
	listRunButtonsOperation,
} from "./run-button-operations.js";
import {
	getWorkspaceSharingOperation,
	updateWorkspaceSharingOperation,
} from "./workspace-sharing-operations.js";

/** Every operation of public sharing; all behind `PUBLIC_SHARING_ENABLED`. */
export const publicSharingOperations: readonly AnyOperation[] = [
	getWorkspaceSharingOperation,
	updateWorkspaceSharingOperation,
	...publicLinkOperations,
	getPublicCollectionOperation,
	...guestLinkOperations,
	viewGuestCollectionOperation,
	...accessKeyOperations,
	createRunButtonOperation,
	listRunButtonsOperation,
	deleteRunButtonOperation,
	getRunButtonOperation,
	importRunButtonOperation,
];
