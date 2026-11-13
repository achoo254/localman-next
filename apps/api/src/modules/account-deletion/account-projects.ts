import { OperationError } from "@localman/operations";
import type { ClientSession, Types } from "mongoose";
import { duplicateKeyFields } from "../../db/mongo-errors.js";
import { MAX_QUOTA_ATTEMPTS, lowestFreeSlots } from "../billing/quota-slots.js";
import {
	CollaboratorModel,
	type StoredCollaborator,
} from "../collaborators/collaborator-model.js";
import { OutboundJobModel } from "../mock-callbacks/outbound-job-model.js";
import { inProjectTransaction } from "../projects/project-lock.js";
import { ProjectModel, type StoredProject } from "../projects/project-model.js";
import { deleteProjectCascade } from "../projects/project-service.js";
import { ResourceModel } from "../resources/resource-model.js";

export interface ProjectOutcome {
	readonly transferred: number;
	readonly deleted: number;
}

/**
 * The member who takes over a shared project: project members have no
 * roles besides the owner, so the earliest to join.
 */
async function heirOf(projectId: Types.ObjectId): Promise<string | null> {
	const row = await CollaboratorModel.findOne({
		projectId,
		status: "accepted",
		inviteeUserId: { $exists: true },
	})
		.sort({ acceptedAt: 1, createdAt: 1, _id: 1 })
		.lean<StoredCollaborator>();
	return row?.inviteeUserId ?? null;
}

async function slotsOf(
	read: Promise<{ quotaSlot: number }[]>,
	count: number,
): Promise<number[]> {
	const taken = (await read).map((row) => row.quotaSlot);
	return lowestFreeSlots(taken, count);
}

/**
 * Moves the project, its resources (billed to the owner) and its queued
 * deliveries to `heir`, on free quota slots of theirs, and ends the heir's
 * membership row (an owner is no collaborator). Like a workspace hand-over,
 * it happens even past the heir's limits: they are then only blocked from
 * creating more. Does nothing when the project already moved.
 */
async function moveInSession(
	projectId: Types.ObjectId,
	from: string,
	heir: string,
	session: ClientSession,
): Promise<void> {
	const moving = await ProjectModel.exists({
		_id: projectId,
		owner: from,
	}).session(session);
	if (!moving) return;
	const [slot] = await slotsOf(
		ProjectModel.find({ owner: heir }, { quotaSlot: 1 })
			.session(session)
			.lean<{ quotaSlot: number }[]>(),
		1,
	);
	await ProjectModel.updateOne(
		{ _id: projectId },
		{ $set: { owner: heir, quotaSlot: slot } },
		{ session },
	);
	const resources = await ResourceModel.find({ projectId }, { _id: 1 })
		.session(session)
		.lean<{ _id: Types.ObjectId }[]>();
	const resourceSlots = await slotsOf(
		ResourceModel.find({ ownerSub: heir }, { quotaSlot: 1 })
			.session(session)
			.lean<{ quotaSlot: number }[]>(),
		resources.length,
	);
	for (const [index, resource] of resources.entries()) {
		await ResourceModel.updateOne(
			{ _id: resource._id },
			{ $set: { ownerSub: heir, quotaSlot: resourceSlots[index] } },
			{ session },
		);
	}
	await CollaboratorModel.deleteOne(
		{ projectId, inviteeUserId: heir },
		{ session },
	);
	await OutboundJobModel.updateMany(
		{ projectId },
		{ $set: { owner: heir } },
		{ session },
	);
}

/**
 * `moveInSession` under the project lock. A create of the heir racing for
 * the same quota slot fails the unique index; the move then re-reads the
 * slots and tries again, as creates do.
 */
export async function transferProject(
	projectId: Types.ObjectId,
	from: string,
	heir: string,
): Promise<void> {
	for (let attempt = 0; attempt < MAX_QUOTA_ATTEMPTS; attempt += 1) {
		try {
			await inProjectTransaction(projectId, (session) =>
				moveInSession(projectId, from, heir, session),
			);
			return;
		} catch (error) {
			if (!duplicateKeyFields(error).includes("quotaSlot")) throw error;
		}
	}
	throw new OperationError(
		409,
		"ACCOUNT_DELETION_CONFLICT",
		"A project could not be handed over; try again",
	);
}

/**
 * Every project the account owns: a live one with members goes to the
 * earliest member, the others (no member, or a tombstone left by an
 * interrupted deletion) are deleted with everything in them.
 */
export async function transferOrDeleteProjects(
	sub: string,
): Promise<ProjectOutcome> {
	const owned = await ProjectModel.find({ owner: sub }).lean<StoredProject[]>();
	let transferred = 0;
	let deleted = 0;
	for (const project of owned) {
		const live = project.deletingAt == null;
		const heir = live ? await heirOf(project._id) : null;
		if (heir) {
			await transferProject(project._id, sub, heir);
			transferred += 1;
		} else {
			await deleteProjectCascade(project);
			deleted += 1;
		}
	}
	return { transferred, deleted };
}
