import { OperationError } from "@localman/operations";
import { limitsFor } from "@localman/shared";
import type { Types } from "mongoose";
import { isDuplicateKeyError } from "../../db/mongo-errors.js";
import { currentPlanOf } from "../billing/plan-guard.js";
import { RequestLogModel } from "../mock-runtime/request-log-model.js";
import { requestLog } from "../mock-runtime/request-log-service.js";
import { LOG_QUERY_MAX_MS } from "../mock-runtime/request-log-store.js";
import {
	InboxModel,
	type InboxResponse,
	type StoredInbox,
} from "./inbox-model.js";

export function inboxNotFound(): OperationError {
	return new OperationError(404, "NOT_FOUND", "Inbox not found");
}

/** The inbox `name` of the project; 404 otherwise. */
export async function requireInbox(
	projectId: Types.ObjectId,
	name: string,
): Promise<StoredInbox> {
	const inbox = await InboxModel.findOne({
		projectId,
		name,
	}).lean<StoredInbox>();
	if (!inbox) throw inboxNotFound();
	return inbox;
}

/** The project's inboxes, oldest first. */
export function listInboxes(projectId: Types.ObjectId): Promise<StoredInbox[]> {
	return InboxModel.find({ projectId })
		.sort({ createdAt: 1, _id: 1 })
		.lean<StoredInbox[]>();
}

/**
 * Inbox lines still in the project's request log, by inbox name. Only
 * the project's current inboxes are counted, on the partial index of
 * inbox lines (`{ projectId, inbox }`), never the whole log.
 */
export async function requestCounts(
	projectId: Types.ObjectId,
): Promise<Map<string, number>> {
	const names: string[] = await InboxModel.distinct("name", { projectId });
	if (names.length === 0) return new Map();
	await requestLog.flush();
	const rows = await RequestLogModel.aggregate<{ _id: string; n: number }>([
		{ $match: { projectId, source: "inbox", inbox: { $in: names } } },
		{ $group: { _id: "$inbox", n: { $sum: 1 } } },
	]).option({ maxTimeMS: LOG_QUERY_MAX_MS });
	return new Map(rows.map((row) => [row._id, row.n]));
}

/** Inboxes the owner's plan allows in one project. */
export async function inboxLimitOf(owner: string): Promise<number> {
	return limitsFor(await currentPlanOf(owner)).webhookInboxes;
}

/** 403 `PLAN_LIMIT_REACHED`, the shape of the other plan limits. */
function limitReached(max: number, used: number): OperationError {
	return new OperationError(
		403,
		"PLAN_LIMIT_REACHED",
		`Limit reached: at most ${max} webhook inboxes per project`,
		{ limit: "webhookInboxes", max, used },
	);
}

/**
 * Creates an inbox within the owner plan's `webhookInboxes` per project.
 * Creates racing for the last slot may both insert; then the newer one
 * removes itself and gets 403 too. A taken
 * name answers 409 `INBOX_NAME_TAKEN`.
 */
export async function createInbox(
	projectId: Types.ObjectId,
	owner: string,
	name: string,
	response: InboxResponse,
): Promise<StoredInbox> {
	const max = await inboxLimitOf(owner);
	const used = await InboxModel.countDocuments({ projectId });
	if (used >= max) throw limitReached(max, used);
	let created: StoredInbox;
	try {
		const doc = await InboxModel.create({ projectId, name, response });
		created = doc.toObject<StoredInbox>();
	} catch (error) {
		if (!isDuplicateKeyError(error)) throw error;
		throw new OperationError(
			409,
			"INBOX_NAME_TAKEN",
			"This project already has an inbox with this name",
		);
	}
	// The oldest `max` inboxes keep their slots; a later one gives way.
	const ids = await InboxModel.find({ projectId })
		.sort({ _id: 1 })
		.select("_id")
		.lean<{ _id: Types.ObjectId }[]>();
	const position = ids.findIndex((row) => row._id.equals(created._id));
	if (position >= max) {
		await InboxModel.deleteOne({ _id: created._id });
		throw limitReached(max, ids.length - 1);
	}
	return created;
}
