/**
 * The page a Run button opens: a preview of what it imports, then the
 * import into a workspace of the caller. Both take the button id in the
 * body, out of URLs and logs.
 */
import { defineOperation } from "@localman/operations";
import {
	RUN_BUTTON_VISIBILITIES,
	countImportedRequests,
} from "@localman/shared/api-client";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { workspaceIdSchema } from "../workspaces/workspace-crud-operations.js";
import { requireWorkspace } from "../workspaces/workspace-roles.js";
import { takeSignedInSlot } from "./public-sharing-limits.js";
import { importFromButton, importTreeOf } from "./run-button-import.js";
import { runSourceFor } from "./run-button-source.js";
import { scriptLocations } from "./run-button-tree.js";

const buttonIdSchema = z.string().min(1).max(64);
const NOT_FOUND =
	"404 RUN_BUTTON_NOT_FOUND for an unknown or deleted button, a trashed collection, a creator who is no longer an Admin or Editor of its workspace, public links turned off there (public buttons), or a caller outside that workspace (team buttons); 429 RATE_LIMITED.";

export const getRunButtonOperation = defineOperation({
	id: "client.getRunButton",
	method: "POST",
	path: "/run-buttons/preview",
	summary: "Preview what a Run in Localman button imports",
	description: `The collection's name, description and request count, whether an environment comes with it, and where its scripts are (scripts run in the importer's browser with their environment, so a public button leaves them out unless asked). ${NOT_FOUND}`,
	input: z.object({ buttonId: buttonIdSchema }),
	output: z.object({
		name: z.string(),
		description: z.string(),
		requestCount: z.number().int(),
		visibility: z.enum(RUN_BUTTON_VISIBILITIES),
		environmentName: z.string().nullable(),
		environmentUnavailable: z.boolean(),
		scripts: z.array(
			z.object({ path: z.array(z.string()), phase: z.enum(["pre", "post"]) }),
		),
	}),
	scopes: [USER_SCOPE],
	// Reads only; POST keeps the button id out of URLs and logs.
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	handler: async (ctx, { buttonId }) => {
		const sub = requireSubject(ctx);
		await takeSignedInSlot("runButton", sub, ctx.clientIp);
		const source = await runSourceFor(sub, buttonId);
		const tree = await importTreeOf(source, true);
		return {
			name: tree.name,
			description: tree.description,
			requestCount: countImportedRequests(tree.items),
			visibility: source.button.visibility,
			environmentName: source.environment?.name ?? null,
			environmentUnavailable: source.environmentUnavailable,
			scripts: scriptLocations(tree),
		};
	},
});

export const importRunButtonOperation = defineOperation({
	id: "client.importRunButton",
	method: "POST",
	path: "/run-buttons/import",
	summary: "Import a Run in Localman button's collection into a workspace",
	description: `Creates the redacted collection (and the button's environment with its shared, non-secret values) in \`workspaceId\`, where the caller must be an Admin or Editor (404/403 otherwise). \`includeScripts: false\` leaves every pre-request and test script out. The same \`idempotencyKey\` within ten minutes returns the first result (409 IMPORT_IN_PROGRESS while it runs). Workspace limits apply (409 COLLECTION_LIMIT_REACHED; 413 COLLECTION_TOO_LARGE). When the environment cannot be created (its limit, or it is no longer available) the collection still is and \`environmentError\` says why. ${NOT_FOUND} Call with dryRun to check the workspace first.`,
	input: z.object({
		buttonId: buttonIdSchema,
		workspaceId: workspaceIdSchema,
		includeScripts: z.boolean(),
		idempotencyKey: z.string().min(8).max(64),
	}),
	output: z.object({
		dryRun: z.boolean(),
		workspaceId: z.string(),
		collectionId: z.string().nullable(),
		environmentId: z.string().nullable(),
		environmentError: z
			.object({ code: z.string(), message: z.string() })
			.nullable(),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "client",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		await takeSignedInSlot("runButton", sub, ctx.clientIp);
		const source = await runSourceFor(sub, input.buttonId);
		if (ctx.dryRun) {
			await requireWorkspace(sub, "addElements", input.workspaceId);
			return {
				dryRun: true,
				workspaceId: input.workspaceId,
				collectionId: null,
				environmentId: null,
				environmentError: null,
			};
		}
		return { dryRun: false, ...(await importFromButton(sub, source, input)) };
	},
});
