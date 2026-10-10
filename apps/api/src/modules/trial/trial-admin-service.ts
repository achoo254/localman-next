import { OperationError } from "@localman/operations";
import { TRIAL_EXTENSION_STATUSES } from "@localman/shared";
import { Types } from "mongoose";
import { z } from "zod";
import { UserModel } from "../users/user-model.js";
import {
	type StoredTrialExtension,
	TrialExtensionModel,
} from "./trial-extension-model.js";

export const EXTENSION_PAGE_SIZE = 50;

export const extensionItemSchema = z.object({
	id: z.string(),
	/** `null` fields: the account is gone or has no name. */
	user: z.object({
		sub: z.string(),
		username: z.string().nullable(),
		name: z.string().nullable(),
	}),
	reason: z.string(),
	requestedAt: z.string(),
	status: z.enum(TRIAL_EXTENSION_STATUSES),
	/** The user's current Pro end (`planExpiresAt`), `null` when none. */
	trialEndsAt: z.string().nullable(),
});

export type ExtensionItem = z.output<typeof extensionItemSchema>;

interface ListedUser {
	sub: string;
	username?: string | null;
	name?: string | null;
	planExpiresAt?: Date | null;
}

/** Items of `requests` with their users' names and current trial ends. */
export async function toExtensionItems(
	requests: readonly StoredTrialExtension[],
): Promise<ExtensionItem[]> {
	const subs = [...new Set(requests.map((request) => request.userSub))];
	const users = await UserModel.find({ sub: { $in: subs } })
		.select("sub username name planExpiresAt")
		.lean<ListedUser[]>();
	const bySub = new Map(users.map((user) => [user.sub, user]));
	return requests.map((request) => {
		const user = bySub.get(request.userSub);
		return {
			id: request._id.toHexString(),
			user: {
				sub: request.userSub,
				username: user?.username ?? null,
				name: user?.name ?? null,
			},
			reason: request.reason,
			requestedAt: request.requestedAt.toISOString(),
			status: request.status,
			trialEndsAt: user?.planExpiresAt?.toISOString() ?? null,
		};
	});
}

/** `<requestedAt ms>_<id>` of the last item of a page. */
function cursorOf(request: StoredTrialExtension): string {
	return `${request.requestedAt.getTime()}_${request._id.toHexString()}`;
}

function parseCursor(cursor: string): { at: Date; id: Types.ObjectId } {
	const match = /^(\d{1,15})_([a-f\d]{24})$/i.exec(cursor);
	if (!match?.[1] || !match[2]) {
		throw new OperationError(400, "VALIDATION_ERROR", "Invalid cursor");
	}
	return { at: new Date(Number(match[1])), id: new Types.ObjectId(match[2]) };
}

/** Newest first, one page after `cursor`. */
export async function listExtensions(
	status: "pending" | "all",
	cursor: string | undefined,
): Promise<{ items: ExtensionItem[]; nextCursor: string | null }> {
	const after = cursor ? parseCursor(cursor) : null;
	const filter = {
		...(status === "pending" ? { status: "pending" as const } : {}),
		...(after
			? {
					$or: [
						{ requestedAt: { $lt: after.at } },
						{ requestedAt: after.at, _id: { $lt: after.id } },
					],
				}
			: {}),
	};
	const docs = await TrialExtensionModel.find(filter)
		.sort({ requestedAt: -1, _id: -1 })
		.limit(EXTENSION_PAGE_SIZE + 1)
		.lean<StoredTrialExtension[]>();
	const page = docs.slice(0, EXTENSION_PAGE_SIZE);
	const last = page.at(-1);
	return {
		items: await toExtensionItems(page),
		nextCursor:
			docs.length > EXTENSION_PAGE_SIZE && last ? cursorOf(last) : null,
	};
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Moves a pending request to `status`; only one decision wins when two
 * owners click at once. 404 `NOT_FOUND`, 409 `EXTENSION_DECIDED`.
 */
export async function decideExtension(
	id: string,
	status: "approved" | "declined",
	owner: string,
	now: Date,
): Promise<StoredTrialExtension> {
	const _id = OBJECT_ID.test(id) ? new Types.ObjectId(id) : null;
	if (!_id) throw new OperationError(404, "NOT_FOUND", "Request not found");
	const decided = await TrialExtensionModel.findOneAndUpdate(
		{ _id, status: "pending" },
		{ $set: { status, decidedAt: now, decidedBy: owner } },
		{ returnDocument: "after" },
	).lean<StoredTrialExtension>();
	if (decided) return decided;
	const exists = await TrialExtensionModel.exists({ _id });
	throw exists
		? new OperationError(
				409,
				"EXTENSION_DECIDED",
				"This request was already decided",
			)
		: new OperationError(404, "NOT_FOUND", "Request not found");
}

/** Puts a request whose approval failed back to pending. */
export async function reopenExtension(id: Types.ObjectId): Promise<void> {
	await TrialExtensionModel.updateOne(
		{ _id: id, status: "approved" },
		{ $set: { status: "pending" }, $unset: { decidedAt: 1, decidedBy: 1 } },
	);
}
