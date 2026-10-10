import { type Types, mongo } from "mongoose";
import { type StoredPlan, storedPlanOf } from "../billing/plan-guard.js";
import { LIVE_PROJECT, ProjectModel } from "../projects/project-model.js";

/** What delivering and logging a job need of its project. */
export interface JobProject {
	readonly id: Types.ObjectId;
	readonly owner: string;
	readonly ownerPlan: StoredPlan;
	readonly redactHeaders: readonly string[];
}

/** The live project of a job, read when it runs; `null` once deleted. */
export async function loadJobProject(
	projectId: Types.ObjectId,
): Promise<JobProject | null> {
	const project = await ProjectModel.findOne({
		_id: projectId,
		...LIVE_PROJECT,
	})
		.select("owner redactHeaders")
		.lean<{ owner: string; redactHeaders?: string[] }>();
	if (!project) return null;
	return {
		id: projectId,
		owner: project.owner,
		ownerPlan: await storedPlanOf(project.owner),
		redactHeaders: project.redactHeaders ?? [],
	};
}

/** A stored body as bytes: lean reads give the driver's `Binary`. */
export function bytesOf(value: unknown): Buffer | null {
	if (Buffer.isBuffer(value)) return value.length > 0 ? value : null;
	if (value instanceof mongo.Binary) {
		const bytes = Buffer.from(value.buffer);
		return bytes.length > 0 ? bytes : null;
	}
	return null;
}
