import { defineOperation } from "@localman/operations";
import { CHANGELOG_REVISIONS_MAX } from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { restoreToChange } from "./change-restore-service.js";
import { CHANGELOG_PAGE } from "./changelog-page.js";
import {
	listActivity,
	listChangelog,
	revisionDiff,
	setRevisionHidden,
} from "./changelog-service.js";
import {
	activityView,
	changeView,
	changelogPageView,
	diffView,
} from "./changelog-view.js";
import {
	ACCESS_NOTE,
	COLLECTION_PATH,
	collectionIdSchema,
} from "./collection-read-operations.js";
import { collectionDetailView } from "./collection-view.js";

const CHANGELOG_PATH = `${COLLECTION_PATH}/changelog`;
const REVISION_PATH = `${CHANGELOG_PATH}/:revisionId`;
const revisionInput = z.object({
	collectionId: collectionIdSchema,
	revisionId: z.string().min(1).max(64),
});
const MISSING =
	"404 REVISION_NOT_FOUND for a change not in this collection's changelog.";

export const getCollectionChangelogOperation = defineOperation({
	id: "client.getCollectionChangelog",
	method: "GET",
	path: CHANGELOG_PATH,
	summary: "List the changelog of a collection",
	description: `Changes newest first, about ${CHANGELOG_PAGE} per page, grouped into sessions (one author's consecutive changes within 5 minutes of the session's first change; a page always ends on a whole session); pass \`nextBefore\` as \`before\` for older ones. Each change names the entity (collection, folder, request, example), the action and the fields it changed; \`restorable\` says whether restore_collection_change can go back to it. The last ${CHANGELOG_REVISIONS_MAX} changes are kept. Viewers may read it. ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		before: z
			.string()
			.regex(/^\d{1,12}$/)
			.optional(),
	}),
	output: changelogPageView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		listChangelog(requireSubject(ctx), input.collectionId, input.before),
});

export const getCollectionChangeDiffOperation = defineOperation({
	id: "client.getCollectionChangeDiff",
	method: "GET",
	path: `${REVISION_PATH}/diff`,
	summary: "Show what one change of a collection changed",
	description: `The entity (collection root, folder, request or example) right before and after the change, as JSON; \`null\` on the side where it did not exist. \`hidden: true\` when an Editor hid it: Editors and Admins still get the diff, Viewers get \`available: false\`, as when it was too large to keep. ${MISSING} ${ACCESS_NOTE}`,
	input: revisionInput,
	output: diffView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) =>
		revisionDiff(requireSubject(ctx), input.collectionId, input.revisionId),
});

function visibilityOperation(hidden: boolean) {
	return defineOperation({
		id: hidden ? "client.hideCollectionChange" : "client.showCollectionChange",
		method: "POST",
		path: `${REVISION_PATH}/${hidden ? "hide" : "show"}`,
		summary: hidden
			? "Hide the diff of one change"
			: "Show a hidden diff again",
		description: `Editors. The change stays in the changelog; ${hidden ? "Viewers then see only who changed what and when, Editors still see the diff" : "its diff is visible again"}. ${MISSING} ${ACCESS_NOTE}`,
		input: revisionInput,
		output: changeView,
		scopes: [USER_SCOPE],
		annotations: { readOnly: false, destructive: false, idempotent: true },
		toolset: "client",
		mcp: true,
		handler: async (ctx, input) =>
			setRevisionHidden(
				requireSubject(ctx),
				input.collectionId,
				input.revisionId,
				hidden,
			),
	});
}

export const restoreCollectionChangeOperation = defineOperation({
	id: "client.restoreCollectionChange",
	method: "POST",
	path: `${REVISION_PATH}/restore`,
	summary: "Restore a collection to the state right after one change",
	description: `Editors. Undoes every later change and records the result as one new change; nothing is deleted from the changelog. \`irreversible\` (also on dryRun) says the restore itself is too large to keep a diff: it could not be undone and would block restoring older changes. 409 REVISION_UNAVAILABLE when the change was trimmed away or a later one was too large to keep; 409 COLLECTION_NODES_LIMIT and 413 COLLECTION_TOO_LARGE as for edits. ${MISSING} ${ACCESS_NOTE}`,
	input: revisionInput,
	output: z.object({
		dryRun: z.boolean(),
		restored: z.boolean(),
		irreversible: z.boolean(),
		collection: collectionDetailView.nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "client",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) =>
		restoreToChange(
			requireSubject(ctx),
			input.collectionId,
			input.revisionId,
			ctx.dryRun,
		),
});

export const getCollectionActivityOperation = defineOperation({
	id: "client.getCollectionActivity",
	method: "GET",
	path: `${COLLECTION_PATH}/activity`,
	summary: "Recent activity of a collection",
	description: `The latest changes (default 10, at most 50) with their authors, for the Overview. ${ACCESS_NOTE}`,
	input: z.object({
		collectionId: collectionIdSchema,
		limit: z.number().int().min(1).max(50).default(10),
	}),
	output: activityView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, input) => ({
		items: await listActivity(
			requireSubject(ctx),
			input.collectionId,
			input.limit,
		),
	}),
});

export const changelogOperations = [
	getCollectionChangelogOperation,
	getCollectionChangeDiffOperation,
	visibilityOperation(true),
	visibilityOperation(false),
	restoreCollectionChangeOperation,
	getCollectionActivityOperation,
] as const;
