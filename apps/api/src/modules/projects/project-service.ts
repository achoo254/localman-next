import { OperationError } from "@localman/operations";
import { PROJECT_NAME_MAX, type ProjectInput } from "@localman/shared";
import { customAlphabet } from "nanoid";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { assertProjectQuota, currentPlanOf } from "../billing/plan-guard.js";
import { type ProjectAction, can } from "./project-access.js";
import { projectDependents } from "./project-dependents.js";
import {
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

/**
 * Every losing racer of a slot retries; each round lets at least one
 * create through, so only a burst this large from one owner can exhaust it.
 */
const MAX_CREATE_ATTEMPTS = 25;
const COPY_SUFFIX = " (copy)";

function lowestFreeSlot(taken: readonly number[]): number {
	const used = new Set(taken);
	let slot = 0;
	while (used.has(slot)) slot += 1;
	return slot;
}

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
	for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
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
				quotaSlot: lowestFreeSlot(owned.map((p) => p.quotaSlot)),
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
	const project = await findProjectById(projectId);
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
 * Deletes dependents first, then the project: a failure midway leaves a
 * project that can be deleted again rather than orphaned data.
 */
export async function deleteProjectCascade(
	project: StoredProject,
): Promise<void> {
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
