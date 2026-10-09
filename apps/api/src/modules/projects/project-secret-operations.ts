import { OperationError, defineOperation } from "@localman/operations";
import { z } from "zod";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { USER_SCOPE, requireSubject } from "../../http/require-auth.js";
import { CollaboratorModel } from "../collaborators/collaborator-model.js";
import { forgetMockProject } from "../mock-runtime/resolve-project.js";
import { getNotificationService } from "../notifications/notification-runtime.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
} from "./project-model.js";
import { newProjectSecret, requireProject } from "./project-service.js";
import { projectView, toProjectView } from "./project-view.js";

/** A new secret collides with an existing one about never; retry anyway. */
const SECRET_ATTEMPTS = 3;

/**
 * Gives the project a new secret (a new mock URL). The old URL stops
 * working at once: the mock runtime's cache entry of the old secret is
 * dropped in this process.
 */
async function replaceSecret(project: StoredProject): Promise<StoredProject> {
	for (let attempt = 0; attempt < SECRET_ATTEMPTS; attempt += 1) {
		try {
			const updated = await ProjectModel.findOneAndUpdate(
				{ _id: project._id, ...LIVE_PROJECT },
				{ $set: { secret: newProjectSecret() } },
				{ returnDocument: "after" },
			).lean<StoredProject>();
			if (!updated) {
				throw new OperationError(404, "NOT_FOUND", "Project not found");
			}
			forgetMockProject(project.secret);
			return updated;
		} catch (error) {
			if (!isDuplicateKeyError(error)) throw error;
		}
	}
	throw new OperationError(
		409,
		"CONFLICT",
		"Could not pick a new secret; try again",
	);
}

/** Accepted collaborators, who keep using the project under the new URL. */
async function collaboratorSubs(project: StoredProject): Promise<string[]> {
	const rows = await CollaboratorModel.find({
		projectId: project._id,
		status: "accepted",
	})
		.select("inviteeUserId")
		.lean<{ inviteeUserId?: string | null }[]>();
	return rows.flatMap((row) => (row.inviteeUserId ? [row.inviteeUserId] : []));
}

export const rotateProjectSecret = defineOperation({
	id: "mock.rotateProjectSecret",
	method: "POST",
	path: "/projects/:projectId/rotate-secret",
	summary: "Give a mock project a new secret (new mock URL)",
	description:
		"Owner only. The mock URL works like a bearer credential: anyone who knows it, such as a removed collaborator, can call the mock API. This replaces the secret, so the old URL answers 404 at once; resources and data are kept. Remaining collaborators are notified that the URL changed. Call with dryRun first to see how many collaborators would be notified. Returns the project with its new mockBaseUrl.",
	input: z.object({ projectId: z.string().min(1).max(64) }),
	output: z.object({
		dryRun: z.boolean(),
		/** Accepted collaborators notified (or to notify, in a dry run). */
		collaborators: z.number(),
		project: projectView,
	}),
	scopes: [USER_SCOPE],
	annotations: { readOnly: false, destructive: true, idempotent: false },
	toolset: "mock",
	mcp: true,
	dryRun: true,
	// Wide blast radius: the MCP tool needs a dry run and its confirm token.
	requiresConfirmation: true,
	handler: async (ctx, input) => {
		const sub = requireSubject(ctx);
		const project = await requireProject(sub, "update", input.projectId);
		const subs = await collaboratorSubs(project);
		if (ctx.dryRun) {
			return {
				dryRun: true,
				collaborators: subs.length,
				project: await toProjectView(project, sub),
			};
		}
		const notifications = getNotificationService();
		const updated = await replaceSecret(project);
		for (const collaborator of subs) {
			notifications.notifyLater(collaborator, {
				type: "project.mockUrlChanged",
				title: "URL mock đã đổi",
				body: `Chủ project đã đổi URL mock của project "${updated.name}". URL cũ không còn hoạt động; hãy dùng URL mới trong trang project.`,
				link: `/projects/${updated._id.toHexString()}`,
			});
		}
		return {
			dryRun: false,
			collaborators: subs.length,
			project: await toProjectView(updated, sub),
		};
	},
});
