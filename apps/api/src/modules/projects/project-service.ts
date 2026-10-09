import { OperationError } from "@localman/operations";
import { PROJECT_NAME_MAX, type ProjectInput } from "@localman/shared";
import { customAlphabet } from "nanoid";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { assertProjectQuota, currentPlanOf } from "../billing/plan-guard.js";
import { MAX_QUOTA_ATTEMPTS, lowestFreeSlots } from "../billing/quota-slots.js";
import { forgetMockProject } from "../mock-runtime/resolve-project.js";
import { type ProjectAction, can } from "./project-access.js";
import { projectDependents } from "./project-dependents.js";
import { inProjectTransaction } from "./project-lock.js";
import {
	LIVE_PROJECT,
	ProjectModel,
	type StoredProject,
	findProjectById,
} from "./project-model.js";

/**
 * Secrets become DNS labels (`{secret}.localman.hoandat.com`): lower-case
 * letters and digits only, since hosts are case-insensitive and `_` is not
 * a valid host character. 24 characters give about 124 bits of entropy.
 */
export const newProjectSecret = customAlphabet(
	"0123456789abcdefghijklmnopqrstuvwxyz",
	24,
);

const COPY_SUFFIX = " (copy)";

/**
 * Creates a project owned by `ownerSub` within the plan's project quota.
 * Concurrent creates are serialized by the unique `(owner, quotaSlot)`
 * index: each attempt reads the owned slots, refuses at the limit and takes
 * the lowest free slot. Racers that read the same projects pick the same
 * slot, so only one insert wins and the others re-read and re-check. This
 * needs no transaction (the test mongod is standalone).
 */
export async function createOwnedProject(
	ownerSub: string,
	input: ProjectInput,
): Promise<StoredProject> {
	const plan = await currentPlanOf(ownerSub);
	for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
		const owned = await ProjectModel.find({ owner: ownerSub })
			.select("quotaSlot")
			.lean<{ quotaSlot: number }[]>();
		assertProjectQuota(plan, owned.length);
		try {
			const created = await ProjectModel.create({
				name: input.name,
				prefix: input.prefix,
				secret: newProjectSecret(),
				owner: ownerSub,
				quotaSlot: lowestFreeSlots(
					owned.map((p) => p.quotaSlot),
					1,
				)[0],
			});
			return created.toObject<StoredProject>();
		} catch (error) {
			// Lost the slot (or, astronomically rarely, the secret): re-check.
			if (!isDuplicateKeyError(error)) throw error;
		}
	}
	throw new OperationError(
		409,
		"CONFLICT",
		"Too many projects are being created at once; try again",
	);
}

/**
 * The project if the user may perform `action` on it. A project the user
 * cannot even read answers 404, so its existence never leaks; a readable
 * one the user may not change answers 403.
 */
export async function requireProject(
	userSub: string,
	action: ProjectAction,
	projectId: string,
): Promise<StoredProject> {
	const project = await findProjectById(projectId, action === "delete");
	const user = { sub: userSub };
	if (!project || !(await can(user, "read", project))) {
		throw new OperationError(404, "NOT_FOUND", "Project not found");
	}
	if (action !== "read" && !(await can(user, action, project))) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return project;
}

export async function updateProject(
	project: StoredProject,
	input: ProjectInput,
): Promise<StoredProject> {
	const updated = await ProjectModel.findByIdAndUpdate(
		project._id,
		{ $set: { name: input.name, prefix: input.prefix } },
		{ returnDocument: "after" },
	).lean<StoredProject>();
	if (!updated) throw new OperationError(404, "NOT_FOUND", "Project not found");
	// The mock runtime serves the new prefix at once, not after its cache TTL.
	forgetMockProject(project.secret);
	return updated;
}

export interface DependentCount {
	readonly kind: string;
	readonly count: number;
}

/** What deleting the project would remove, per registered dependent. */
export async function countDependents(
	project: StoredProject,
): Promise<DependentCount[]> {
	return Promise.all(
		projectDependents().map(async (dependent) => ({
			kind: dependent.kind,
			count: await dependent.count(project._id),
		})),
	);
}

/**
 * Deletes a project in three steps, safe to repeat:
 * 1. under the project lock, set the `deletingAt` tombstone: from then on
 *    every read and lock-checked write treats the project as gone, and a
 *    write racing this step either commits first or retries into 404;
 * 2. let every dependent remove its data (`deleteAll` is idempotent);
 * 3. delete the document, which frees the project's quota slot.
 * If step 2 fails, the tombstone stays and a repeated DELETE resumes.
 */
export async function deleteProjectCascade(
	project: StoredProject,
): Promise<void> {
	await inProjectTransaction(
		project._id,
		async (session) => {
			await ProjectModel.updateOne(
				{ _id: project._id, ...LIVE_PROJECT },
				{ $set: { deletingAt: new Date() } },
				{ session },
			);
		},
		{ allowDeletedProject: true },
	);
	forgetMockProject(project.secret);
	for (const dependent of projectDependents()) {
		await dependent.deleteAll(project._id);
	}
	await ProjectModel.deleteOne({ _id: project._id });
}

/**
 * "<name> (copy)", shortening the name by whole code points (never
 * splitting a surrogate pair) so the result still fits the name limit,
 * which counts UTF-16 units like zod's `max`.
 */
export function copyName(name: string): string {
	const room = PROJECT_NAME_MAX - COPY_SUFFIX.length;
	let kept = "";
	for (const codePoint of Array.from(name)) {
		if (kept.length + codePoint.length > room) break;
		kept += codePoint;
	}
	return `${kept.trimEnd()}${COPY_SUFFIX}`;
}

/**
 * Copies a project into the caller's account with a new secret, then lets
 * every dependent copy its data. A failed copy removes the partial clone.
 */
export async function cloneProject(
	source: StoredProject,
	ownerSub: string,
): Promise<StoredProject> {
	const clone = await createOwnedProject(ownerSub, {
		name: copyName(source.name),
		prefix: source.prefix,
	});
	try {
		for (const dependent of projectDependents()) {
			await dependent.copy?.(source._id, clone._id);
		}
	} catch (error) {
		await deleteProjectCascade(clone);
		throw error;
	}
	return clone;
}
