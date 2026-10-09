import type { Types } from "mongoose";
import { ResourceModel } from "../resources/resource-model.js";
import type { StoredProject } from "./project-model.js";

/** What set the last activity of a project, as logged by the cleanup. */
export type ActivitySource =
	| "created"
	| "projectEdit"
	| "mockRequest"
	| "resourceEdit";

export interface ProjectActivity {
	readonly at: Date;
	readonly source: ActivitySource;
}

/** Latest `updatedAt` among the resources of each project, by project id. */
async function lastResourceEdits(
	projectIds: readonly Types.ObjectId[],
): Promise<Map<string, Date>> {
	const rows = await ResourceModel.aggregate<{
		_id: Types.ObjectId;
		updatedAt: Date | null;
	}>([
		{ $match: { projectId: { $in: projectIds } } },
		{ $group: { _id: "$projectId", updatedAt: { $max: "$updatedAt" } } },
	]);
	const edits = new Map<string, Date>();
	for (const row of rows) {
		if (row.updatedAt) edits.set(row._id.toHexString(), row.updatedAt);
	}
	return edits;
}

/**
 * Last activity of each project, by project id: the latest of its last
 * mock request, its last edit and the last edit of any of its resources,
 * or its creation when none is newer. On a tie the first source of
 * creation, project edit, mock request, resource edit is reported.
 */
export async function projectActivities(
	projects: readonly StoredProject[],
): Promise<Map<string, ProjectActivity>> {
	const resourceEdits = await lastResourceEdits(projects.map((p) => p._id));
	const activities = new Map<string, ProjectActivity>();
	for (const project of projects) {
		const projectId = project._id.toHexString();
		const candidates: {
			at: Date | null | undefined;
			source: ActivitySource;
		}[] = [
			{ at: project.updatedAt, source: "projectEdit" },
			{ at: project.lastRequestAt, source: "mockRequest" },
			{ at: resourceEdits.get(projectId), source: "resourceEdit" },
		];
		let latest: ProjectActivity = { at: project.createdAt, source: "created" };
		for (const { at, source } of candidates) {
			if (at && at.getTime() > latest.at.getTime()) latest = { at, source };
		}
		activities.set(projectId, latest);
	}
	return activities;
}
