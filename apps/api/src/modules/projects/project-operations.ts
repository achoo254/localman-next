import { defineOperation } from "@localman/operations";
import { projectInputSchema } from "@localman/shared";
import { z } from "zod";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { accessibleProjectsFilter } from "./project-access.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "./project-model.js";
import {
	cloneProject,
	countDependents,
	createOwnedProject,
	deleteProjectCascade,
	requireProject,
	updateProject,
} from "./project-service.js";
import { projectView, toProjectView, toProjectViews } from "./project-view.js";

const projectId = z.string().min(1).max(64);
const PLAN_LIMIT_NOTE =
	"Fails with 403 PLAN_LIMIT_REACHED (details: limit, max, used) when the caller already owns as many projects as their plan allows.";

export const listProjects = defineOperation({
	id: "mock.listProjects",
	method: "GET",
	path: "/projects",
	summary: "List mock projects",
	description:
		"Projects the signed-in user owns or collaborates on, oldest first, with the mock base URL (`https://{secret}.{domain}{prefix}`), the caller's role, `resourceCount` (nested resources included) and `recordCount` (records over all resources).",
	input: z.object({}),
	output: z.object({ items: z.array(projectView) }),
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx) => {
		const sub = requireSubject(ctx);
		const projects = await ProjectModel.find({
			...(await accessibleProjectsFilter({ sub })),
			...LIVE_PROJECT,
		})
			.sort({ createdAt: 1, _id: 1 })
			.lean<StoredProject[]>();
		return { items: await toProjectViews(projects, sub) };
	},
});

export const getProject = defineOperation({
	id: "mock.getProject",
	method: "GET",
	path: "/projects/:projectId",
	summary: "Get one mock project",
	description:
		"The project with the same fields as an item of list_projects (mock base URL, secret, prefix, owner and the caller's role). Projects the caller cannot read, unknown ids and projects being deleted answer 404.",
	input: z.object({ projectId }),
	output: projectView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: true, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		return toProjectView(
			await requireProject(sub, "read", input.projectId),
			sub,
		);
	},
});

export const createProject = defineOperation({
	id: "mock.createProject",
	method: "POST",
	path: "/projects",
	summary: "Create a mock project",
	description: `Creates an empty mock project owned by the caller with a new random secret. \`prefix\` is normalized to \`/x/y\` (empty for none). ${PLAN_LIMIT_NOTE}`,
	input: projectInputSchema,
	output: projectView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		return toProjectView(await createOwnedProject(sub, input), sub);
	},
});

export const updateProjectDetails = defineOperation({
	id: "mock.updateProject",
	method: "PUT",
	path: "/projects/:projectId",
	summary: "Rename a mock project or change its prefix",
	description:
		"Owner only. Sets the name and the URL prefix (normalized to `/x/y`); the secret and data are kept. Unknown or inaccessible projects answer 404.",
	input: projectInputSchema.extend({ projectId }),
	output: projectView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: true },
	toolset: "mock",
	mcp: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		return toProjectView(await updateProject(project, input), sub);
	},
});

export const deleteProject = defineOperation({
	id: "mock.deleteProject",
	method: "DELETE",
	path: "/projects/:projectId",
	summary: "Delete a mock project and everything in it",
	description:
		"Owner only. Removes the project with its resources, records and collaborators; the mock URL stops working. Call with dryRun first to see what would be removed.",
	input: z.object({ projectId }),
	output: z.object({
		id: z.string(),
		deleted: z.boolean(),
		dryRun: z.boolean(),
		dependents: z.array(z.object({ kind: z.string(), count: z.number() })),
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: true },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	// Wide blast radius: the MCP tool needs a dry run and its confirm token.
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "delete", input.projectId);
		const dependents = await countDependents(project);
		if (!ctx.dryRun) await deleteProjectCascade(project);
		return {
			id: project._id.toHexString(),
			deleted: !ctx.dryRun,
			dryRun: ctx.dryRun,
			dependents,
		};
	},
});

export const cloneProjectCopy = defineOperation({
	id: "mock.cloneProject",
	method: "POST",
	path: "/projects/:projectId/clone",
	summary: "Clone a mock project",
	description: `Copies a project the caller can read (resources, schema and data, not collaborators) into a new project owned by the caller, named "<name> (copy)", with a new secret. ${PLAN_LIMIT_NOTE}`,
	input: z.object({ projectId }),
	output: projectView,
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: false, idempotent: false },
	toolset: "mock",
	mcp: true,
	successStatus: 201,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const source = await requireProject(sub, "clone", input.projectId);
		await takeOperationSlot("clone", sub, source._id.toHexString());
		return toProjectView(await cloneProject(source, sub), sub);
	},
});

export const projectOperations = [
	listProjects,
	getProject,
	createProject,
	updateProjectDetails,
	deleteProject,
	cloneProjectCopy,
] as const;
