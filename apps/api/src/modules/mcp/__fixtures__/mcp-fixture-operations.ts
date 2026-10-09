import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../../http/require-auth.js";

/** TEST ONLY. Real deletions performed by `delete_widget_tree`. */
export const deletedWidgets: string[] = [];

const listWidgets = defineOperation({
	id: "mock.listWidgets",
	method: "GET",
	path: "/widgets",
	summary: "List widgets",
	input: z.object({ limit: z.number().int().min(1).max(50).default(10) }),
	output: z.object({ owner: z.string(), limit: z.number() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: (ctx, input) => ({ owner: requireSubject(ctx), limit: input.limit }),
});

const createWidget = defineOperation({
	id: "mock.createWidget",
	method: "POST",
	path: "/widgets",
	summary: "Create a widget",
	input: z.object({
		name: z.string().min(1),
		color: z.string().default("red"),
	}),
	output: z.object({ id: z.string(), name: z.string(), color: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: (_ctx, input) => ({ id: "w1", ...input }),
});

const deleteWidgetTree = defineOperation({
	id: "mock.deleteWidgetTree",
	method: "DELETE",
	path: "/widgets/:widgetId",
	summary: "Delete a widget and its children",
	input: z.object({
		widgetId: z.string().min(1),
		cascade: z.boolean().default(true),
	}),
	output: z.object({ dryRun: z.boolean(), removed: z.number() }),
	scopes: [USER_SCOPE],
	policy: (_ctx, input) => input.widgetId !== "not-mine",
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	requiresConfirmation: true,
	handler: (ctx, input) => {
		if (!ctx.dryRun) deletedWidgets.push(input.widgetId);
		return { dryRun: ctx.dryRun, removed: input.cascade ? 3 : 1 };
	},
});

/** Destructive but narrow: runs directly, `dry_run` stays optional. */
const resetWidget = defineOperation({
	id: "mock.resetWidget",
	method: "POST",
	path: "/widgets/:widgetId/reset",
	summary: "Reset one widget",
	input: z.object({ widgetId: z.string() }),
	output: z.object({ dryRun: z.boolean(), reset: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: (ctx) => ({ dryRun: ctx.dryRun, reset: !ctx.dryRun }),
});

const previewWidgetColors = defineOperation({
	id: "mock.previewWidgetColors",
	method: "POST",
	path: "/widgets/colors",
	summary: "Recolor widgets",
	input: z.object({ color: z.string() }),
	output: z.object({ dryRun: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	handler: (ctx) => ({ dryRun: ctx.dryRun }),
});

const lockWidget = defineOperation({
	id: "mock.lockWidget",
	method: "POST",
	path: "/widgets/:widgetId/lock",
	summary: "Lock a widget",
	input: z.object({ widgetId: z.string() }),
	output: z.object({ locked: z.boolean() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: (_ctx, input) => {
		if (input.widgetId === "crash")
			throw new Error("database password=hunter2");
		throw new OperationError(409, "WIDGET_LOCKED", "Widget is already locked", {
			widgetId: input.widgetId,
		});
	},
});

const exportWidgets = defineOperation({
	id: "mock.exportWidgets",
	method: "GET",
	path: "/widgets/export",
	summary: "Download widgets as a file",
	input: z.object({}),
	output: z.object({ url: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: { exempt: "Browser download only" },
	handler: () => ({ url: "https://example.test/widgets.csv" }),
});

const listAudits = defineOperation({
	id: "admin.listAudits",
	method: "GET",
	path: "/admin/audits",
	summary: "List audit entries",
	input: z.object({}),
	output: z.object({ entries: z.array(z.string()) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "admin",
	mcp: true,
	handler: () => ({ entries: ["login"] }),
});

const createAccessKey = defineOperation({
	id: "users.createAccessKey",
	method: "POST",
	path: "/users/me/access-keys",
	summary: "Create an access key",
	input: z.object({ label: z.string() }),
	output: z.object({ id: z.string(), secret: z.string() }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "users",
	mcp: true,
	createsCredential: true,
	handler: () => ({ id: "key_1", secret: "shown-once" }),
});

/** TEST ONLY. Registry covering every MCP tool shape. */
export const fixtureOperations = [
	listWidgets,
	createWidget,
	deleteWidgetTree,
	resetWidget,
	previewWidgetColors,
	lockWidget,
	exportWidgets,
	listAudits,
	createAccessKey,
];
