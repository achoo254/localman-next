import { z } from "zod";

/**
 * Names of what Live Mock Sync writes, in the language of whoever linked
 * the collection (the web app sends its translations; agents get these
 * English ones). `{name}` stands for the resource name.
 */
export interface SyncNames {
	readonly list: string;
	readonly get: string;
	readonly create: string;
	readonly update: string;
	readonly patch: string;
	readonly delete: string;
	/** The `_removed` folder's description. */
	readonly removedFolder: string;
	/** Description of a request or folder moved there. */
	readonly removedItem: string;
	/** The environment made with the collection; `{name}` is the project. */
	readonly environment: string;
}

export const DEFAULT_SYNC_NAMES: SyncNames = {
	list: "List {name}",
	get: "Get one of {name}",
	create: "Create in {name}",
	update: "Replace in {name}",
	patch: "Update in {name}",
	delete: "Delete from {name}",
	removedFolder: "Requests the mock no longer serves. Delete them when done.",
	removedItem: "Removed from the mock.",
	environment: "{name} (mock)",
};

const name = z.string().trim().min(1).max(120);

export const syncNamesSchema = z.object({
	list: name,
	get: name,
	create: name,
	update: name,
	patch: name,
	delete: name,
	removedFolder: z.string().trim().min(1).max(500),
	removedItem: z.string().trim().min(1).max(500),
	environment: name,
});

/** `template` with `{name}` replaced (only the first one). */
export const fillName = (template: string, value: string): string =>
	template.replace("{name}", value);
