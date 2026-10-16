import { OperationError } from "@localman/operations";
import {
	type ConflictSide,
	type MergeOption,
	PULL_REQUESTS_OPEN_MAX,
	type PullRequestView,
} from "@localman/shared/api-client";
import { takeOperationSlot } from "../../lib/operation-rate-limit.js";
import { applyMerge } from "./collection-merge-service.js";
import { sidesOf } from "./collection-sync.js";
import { notAFork, requireForkPlan } from "./fork-access.js";
import type { MergeFollowUp } from "./merge-follow-up.js";
import {
	PullRequestModel,
	type StoredPullRequest,
	type StoredReview,
	statusOfReviews,
} from "./pull-request-model.js";
import { tellAboutPullRequest } from "./pull-request-notices.js";
import { checkReviewers } from "./pull-request-people.js";
import {
	pullRequestNotFound,
	requirePullRequest,
	toView,
} from "./pull-request-read.js";
import { pullRequestSides } from "./pull-request-sides.js";
import { claimMerged, writeFresh } from "./pull-request-write.js";

export interface PullRequestInput {
	readonly title: string;
	readonly description: string;
	readonly reviewerIds: readonly string[];
}

const OPENED = { type: "pullRequest.opened" } as const;

/**
 * Opens a pull request from a fork (Editors of the fork, Pro) into its
 * source, asking Editors of the source to review; they are told. 409
 * `PULL_REQUEST_LIMIT` past `PULL_REQUESTS_OPEN_MAX` open ones on the source.
 */
export async function createPullRequest(
	sub: string,
	forkId: string,
	input: PullRequestInput,
): Promise<PullRequestView> {
	const { fork, source } = await sidesOf(sub, forkId, "edit", "view");
	const reviewers = await checkReviewers(
		source.element,
		sub,
		input.reviewerIds,
	);
	const open = await PullRequestModel.countDocuments({
		sourceId: source.collectionId,
		status: { $in: ["open", "approved"] },
	});
	if (open >= PULL_REQUESTS_OPEN_MAX) {
		throw new OperationError(
			409,
			"PULL_REQUEST_LIMIT",
			`A collection takes at most ${PULL_REQUESTS_OPEN_MAX} open pull requests`,
		);
	}
	const created = await PullRequestModel.create({
		sourceId: source.collectionId,
		forkId: fork.collectionId,
		title: input.title,
		description: input.description,
		authorId: sub,
		reviewers: reviewers.map((userId) => ({ userId })),
		notified: reviewers,
	});
	const pr = created.toObject<StoredPullRequest>();
	await tellAboutPullRequest(reviewers, OPENED, sub, pr, source.element.name);
	return toView(sub, pr, source);
}

const pending = (userId: string): StoredReview => ({
	userId,
	decision: "pending",
	at: null,
});

/**
 * Its author edits the title, description or reviewers until it closes.
 * Reviewers kept keep their decision; only those never asked before are
 * told. Takes a `comment` slot, so edits cannot flood anyone.
 */
export async function updatePullRequest(
	sub: string,
	id: string,
	input: Partial<PullRequestInput>,
): Promise<PullRequestView> {
	const { pr, source } = await requirePullRequest(sub, id);
	if (pr.authorId !== sub) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"Only its author edits a pull request",
		);
	}
	await takeOperationSlot("comment", sub, source.element.id);
	const ids = input.reviewerIds
		? await checkReviewers(source.element, sub, input.reviewerIds)
		: null;
	let added: string[] = [];
	const updated = await writeFresh(pr, (current) => {
		const kept = new Map(current.reviewers.map((r) => [r.userId, r]));
		const reviewers = ids
			? ids.map((userId) => kept.get(userId) ?? pending(userId))
			: current.reviewers;
		const told = new Set(current.notified ?? []);
		added = (ids ?? []).filter((userId) => !told.has(userId));
		return {
			...(input.title === undefined ? {} : { title: input.title }),
			...(input.description === undefined
				? {}
				: { description: input.description }),
			reviewers,
			notified: [...told, ...added],
			status: statusOfReviews(reviewers),
		};
	});
	await tellAboutPullRequest(added, OPENED, sub, updated, source.element.name);
	return toView(sub, updated, source);
}

/** A reviewer approves or declines it; the author is told. */
export async function reviewPullRequest(
	sub: string,
	id: string,
	decision: "approved" | "declined",
): Promise<PullRequestView> {
	const { pr, source } = await requirePullRequest(sub, id);
	const updated = await writeFresh(pr, (current) => {
		if (!current.reviewers.some((review) => review.userId === sub)) {
			throw new OperationError(
				403,
				"FORBIDDEN",
				"Only its reviewers review a pull request",
			);
		}
		const reviewers = current.reviewers.map((review) =>
			review.userId === sub ? { ...review, decision, at: new Date() } : review,
		);
		return { reviewers, status: statusOfReviews(reviewers) };
	});
	const notice = { type: "pullRequest.reviewed", decision } as const;
	await tellAboutPullRequest(
		[pr.authorId],
		notice,
		sub,
		updated,
		source.element.name,
	);
	return toView(sub, updated, source);
}

/**
 * Merges an open or approved pull request (Editors of the source, Pro):
 * the fork's merge with its option and choices, marking it merged in the
 * same transaction. A plain merge needs no access to the fork; the other
 * options act on it, so they need Editor there. Its author is told.
 */
export async function mergePullRequest(
	sub: string,
	id: string,
	option: MergeOption,
	resolutions: Readonly<Record<string, ConflictSide>>,
): Promise<{ pullRequest: PullRequestView; followUp: MergeFollowUp }> {
	const { pr, source } = await requirePullRequest(sub, id, "mergeFork");
	await requireForkPlan(sub);
	const forkId = pr.forkId.toHexString();
	const sides =
		option === "merge"
			? await pullRequestSides(sub, pr, source)
			: await sidesOf(sub, forkId, "edit", "mergeFork");
	if (!sides?.link.sourceId.equals(pr.sourceId)) throw notAFork();
	const followUp = await applyMerge(sub, forkId, option, resolutions, {
		sides,
		alongside: (session) => claimMerged(pr._id, sub, session),
	});
	const merged = await PullRequestModel.findById(
		pr._id,
	).lean<StoredPullRequest>();
	if (!merged) throw pullRequestNotFound();
	await tellAboutPullRequest(
		[pr.authorId],
		{ type: "pullRequest.merged" },
		sub,
		merged,
		source.element.name,
	);
	return { pullRequest: await toView(sub, merged, source), followUp };
}
