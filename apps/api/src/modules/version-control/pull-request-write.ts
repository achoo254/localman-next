import { OperationError } from "@localman/operations";
import type { ClientSession } from "mongoose";
import {
	PullRequestModel,
	type StoredPullRequest,
} from "./pull-request-model.js";

/** Reads that a write may meet changed before it gives up. */
const ATTEMPTS = 5;
const LIVE = { $in: ["open" as const, "approved" as const] };

export const pullRequestClosed = () =>
	new OperationError(
		409,
		"PULL_REQUEST_CLOSED",
		"This pull request is merged or declined",
	);

const isLive = (pr: StoredPullRequest): boolean =>
	pr.status === "open" || pr.status === "approved";

/**
 * Writes what `change` makes of the open pull request as last read, only
 * if nobody wrote it since (its `rev`); otherwise reads it again and
 * recomputes, so concurrent reviews and edits never drop one another.
 * `change` may throw (a reviewer removed meanwhile). 409 once it closes.
 */
export async function writeFresh(
	read: StoredPullRequest,
	change: (pr: StoredPullRequest) => Record<string, unknown>,
): Promise<StoredPullRequest> {
	let pr: StoredPullRequest | null = read;
	for (let attempt = 0; attempt < ATTEMPTS && pr; attempt += 1) {
		if (!isLive(pr)) throw pullRequestClosed();
		const updated = await PullRequestModel.findOneAndUpdate(
			{
				_id: pr._id,
				status: LIVE,
				rev: pr.rev === undefined ? { $exists: false } : pr.rev,
			},
			{ $set: change(pr), $inc: { rev: 1 } },
			{ returnDocument: "after" },
		).lean<StoredPullRequest>();
		if (updated) return updated;
		pr = await PullRequestModel.findById(read._id).lean<StoredPullRequest>();
	}
	if (!pr) throw pullRequestClosed();
	throw new OperationError(
		409,
		"PULL_REQUEST_BUSY",
		"This pull request is changing; try again",
	);
}

/**
 * Marks it merged in the merge's transaction, only while it is open or
 * approved: a second merge or a decline that won the race aborts the merge.
 */
export async function claimMerged(
	id: StoredPullRequest["_id"],
	sub: string,
	session: ClientSession,
): Promise<void> {
	const claimed = await PullRequestModel.updateOne(
		{ _id: id, status: LIVE },
		{
			$set: { status: "merged", mergedBy: sub, mergedAt: new Date() },
			$inc: { rev: 1 },
		},
		{ session },
	);
	if (claimed.modifiedCount === 0) throw pullRequestClosed();
}
