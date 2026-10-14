/** Answers of the Run page's API calls, for its tests. */
import type { RunButtonPreview } from "../../features/public-sharing/run-buttons-api";
import type { Workspace } from "../../features/workspaces/workspaces-api";
import type { MockReply } from "../../test/mock-fetch";

const workspace = (id: string, role: Workspace["role"]): Workspace => ({
	id,
	name: `Space ${id}`,
	description: null,
	type: "team",
	role,
	memberCount: 2,
});

export const WORKSPACES = {
	body: {
		items: [
			workspace("w-viewer", "viewer"),
			workspace("w-editor", "editor"),
			workspace("w-admin", "admin"),
		],
	},
};

/** An import's answer; `environmentError` set when the environment failed. */
export const imported = (environmentError: unknown = null): MockReply => ({
	body: {
		dryRun: false,
		workspaceId: "w-admin",
		collectionId: "c9",
		environmentId: null,
		environmentError,
	},
});

export function preview(overrides: Partial<RunButtonPreview> = {}) {
	const body: RunButtonPreview = {
		name: "Orders API",
		description: "Orders of the shop",
		requestCount: 3,
		visibility: "public",
		environmentName: "Staging",
		environmentUnavailable: false,
		scripts: [{ path: ["Orders", "List orders"], phase: "pre" }],
		...overrides,
	};
	return { body };
}
