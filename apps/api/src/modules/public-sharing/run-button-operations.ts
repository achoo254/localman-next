import { defineOperation } from "@localman/operations";
import {
	RUN_BUTTON_VISIBILITIES,
	findSecretLikeValues,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { elementNotFound } from "../access/access-policy.js";
import { requireCollection } from "../collections/collection-access.js";
import { toObjectId } from "../collections/collection-ids.js";
import {
	COLLECTION_PATH,
	collectionIdSchema,
} from "../collections/collection-read-operations.js";
import { WARNINGS_NOTE, secretWarnings } from "./public-sharing-views.js";
import { publicViewOf } from "./public-tree.js";
import { requirePublishable } from "./publish-access.js";
import { RunButtonModel } from "./run-button-model.js";
import {
	createRunButton,
	findRunButton,
	listRunButtons,
	requireButtonEnvironment,
	toButtonView,
} from "./run-button-service.js";
import { shareableEnvironment } from "./run-button-source.js";

const PATH = `${COLLECTION_PATH}/run-buttons`;

const runButtonView = z.object({
	id: z.string(),
	visibility: z.enum(RUN_BUTTON_VISIBILITIES),
	environmentId: z.string().nullable(),
	url: z.string(),
	badgeUrl: z.string(),
	createdBy: z.string(),
	createdAt: z.string(),
});

export const createRunButtonOperation = defineOperation({
	id: "sharing.createRunButton",
	method: "POST",
	path: PATH,
	summary: "Create a Run in Localman button for a collection",
	description: `A button to embed in a README (\`url\` opens the import page, \`badgeUrl\` is the image). People who click it sign in, pick one of their workspaces and import the redacted collection, with the environment's shared, non-secret values when \`environmentId\` is set (it must be in the collection's workspace and the caller must be able to share its variables). \`team\`: only members of the collection's workspace can use it; \`public\`: anyone signed in, and only while public links are allowed (403 PUBLIC_LINKS_DISABLED). At most 20 per collection (409 RUN_BUTTON_LIMIT_REACHED). Only Admins and Editors who are members of the workspace (403 FORBIDDEN). ${WARNINGS_NOTE} Call with dryRun first.`,
	input: z.object({
		collectionId: collectionIdSchema,
		visibility: z.enum(RUN_BUTTON_VISIBILITIES),
		environmentId: z.string().min(1).max(64).nullable().optional(),
	}),
	output: z.object({
		dryRun: z.boolean(),
		button: runButtonView.nullable(),
		warnings: secretWarnings,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "sharing",
	mcp: true,
	mcpScope: "client:share",
	dryRun: true,
	requiresConfirmation: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const toggle = input.visibility === "public" ? "publicLinksAllowed" : null;
		const access = await requirePublishable(sub, input.collectionId, toggle);
		const environmentId = input.environmentId
			? await requireButtonEnvironment(
					sub,
					input.environmentId,
					access.element.workspaceId,
				)
			: null;
		const view = await publicViewOf({ _id: access.collectionId });
		const environment = environmentId
			? await shareableEnvironment(
					environmentId,
					access.element.workspaceId,
					sub,
				)
			: null;
		const warnings = findSecretLikeValues(view.tree, environment ?? undefined);
		if (ctx.dryRun) return { dryRun: true, button: null, warnings };
		const button = await createRunButton({
			collectionId: access.collectionId,
			environmentId,
			visibility: input.visibility,
			sub,
		});
		return { dryRun: false, button: toButtonView(button), warnings };
	},
});

export const listRunButtonsOperation = defineOperation({
	id: "sharing.listRunButtons",
	method: "GET",
	path: PATH,
	summary: "List the Run buttons of a collection",
	description:
		"Every Run button of the collection, newest first. Anyone who can view the collection. 404 NOT_FOUND for a collection the caller cannot see.",
	input: z.object({ collectionId: collectionIdSchema }),
	output: z.object({ items: z.array(runButtonView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "sharing",
	mcp: true,
	handler: async (ctx, { collectionId }) => {
		const sub = requireSubject(ctx);
		const access = await requireCollection(sub, collectionId, "view");
		const buttons = await listRunButtons(access.collectionId);
		return { items: buttons.map(toButtonView) };
	},
});

export const deleteRunButtonOperation = defineOperation({
	id: "sharing.deleteRunButton",
	method: "DELETE",
	path: `${PATH}/:runButtonId`,
	summary: "Delete a Run button",
	description:
		"The button stops at once; READMEs that embed it lead to a not-found page. Collections already imported stay. Admins and Editors who are members of the workspace (403 FORBIDDEN); 404 NOT_FOUND for an unknown button. Call with dryRun to see it first.",
	input: z.object({
		collectionId: collectionIdSchema,
		runButtonId: z.string().min(1).max(64),
	}),
	output: z.object({
		dryRun: z.boolean(),
		deleted: z.boolean(),
		button: runButtonView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "sharing",
	mcp: true,
	dryRun: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const access = await requirePublishable(sub, input.collectionId, null);
		const id = toObjectId(input.runButtonId);
		const button = id && (await findRunButton(access.collectionId, id));
		if (!button) throw elementNotFound();
		const deleted = ctx.dryRun
			? false
			: (await RunButtonModel.deleteOne({ _id: button._id })).deletedCount > 0;
		return { dryRun: ctx.dryRun, deleted, button: toButtonView(button) };
	},
});
