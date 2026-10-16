import { OperationError } from "@localman/operations";
import { elementRoleAllows } from "@localman/shared/access";
import type {
	PullRequestDetail,
	PullRequestView,
} from "@localman/shared/api-client";
import { Types } from "mongoose";
import {
	type CollectionAccess,
	requireCollection,
} from "../collections/collection-access.js";
import { displayNames } from "../users/display-names.js";
import { ForkModel, type StoredFork } from "./fork-model.js";
import {
	PullRequestModel,
	type StoredPullRequest,
} from "./pull-request-model.js";
import { livePreview } from "./pull-request-sides.js";

/** Pull requests listed at most. */
const LISTED = 100;

export function pullRequestNotFound(): OperationError {
	return new OperationError(
		404,
		"PULL_REQUEST_NOT_FOUND",
		"Pull request not found",
	);
}

/**
 * The pull request if the caller can open its source collection (404 the
 * same way otherwise), with that access; 403 for `mergeFork` without it.
 */
export async function requirePullRequest(
	sub: string,
	id: string,
	action: "view" | "mergeFork" = "view",
): Promise<{ pr: StoredPullRequest; source: CollectionAccess }> {
	if (!Types.ObjectId.isValid(id)) throw pullRequestNotFound();
	const pr = await PullRequestModel.findById(id).lean<StoredPullRequest>();
	if (!pr) throw pullRequestNotFound();
	const source = await requireCollection(
		sub,
		pr.sourceId.toHexString(),
		"view",
	).catch(() => {
		throw pullRequestNotFound();
	});
	if (!elementRoleAllows("collection", source.role, action)) {
		throw new OperationError(
			403,
			"FORBIDDEN",
			"You are not allowed to perform this operation",
		);
	}
	return { pr, source };
}

/** Fork labels and people's names, loaded once for several pull requests. */
interface ViewContext {
	readonly labels: ReadonlyMap<string, string>;
	readonly names: ReadonlyMap<string, string>;
}

async function contextOf(
	prs: readonly StoredPullRequest[],
): Promise<ViewContext> {
	const [links, names] = await Promise.all([
		ForkModel.find({
			kind: "collection",
			forkId: { $in: prs.map((pr) => pr.forkId) },
		}).lean<StoredFork[]>(),
		displayNames(
			prs.flatMap((pr) => [
				pr.authorId,
				...pr.reviewers.map((review) => review.userId),
				...(pr.mergedBy ? [pr.mergedBy] : []),
			]),
		),
	]);
	return {
		labels: new Map(
			links.map((link) => [link.forkId.toHexString(), link.label]),
		),
		names,
	};
}

function viewOf(
	sub: string,
	pr: StoredPullRequest,
	source: CollectionAccess | null,
	{ labels, names }: ViewContext,
): PullRequestView {
	const live = pr.status === "open" || pr.status === "approved";
	const forkLabel = labels.get(pr.forkId.toHexString()) ?? null;
	const merger =
		source !== null &&
		elementRoleAllows("collection", source.role, "mergeFork");
	return {
		id: pr._id.toHexString(),
		sourceId: pr.sourceId.toHexString(),
		sourceName: source?.element.name ?? null,
		forkId: pr.forkId.toHexString(),
		forkLabel,
		title: pr.title,
		description: pr.description,
		authorId: pr.authorId,
		authorName: names.get(pr.authorId) ?? null,
		// People of the source stay hidden from those who cannot open it.
		reviewers: source
			? pr.reviewers.map((review) => ({
					userId: review.userId,
					name: names.get(review.userId) ?? null,
					decision: review.decision,
					at: review.at?.toISOString() ?? null,
				}))
			: [],
		status: pr.status,
		mergedByName: pr.mergedBy ? (names.get(pr.mergedBy) ?? null) : null,
		mergedAt: pr.mergedAt?.toISOString() ?? null,
		createdAt: pr.createdAt.toISOString(),
		canReview: live && pr.reviewers.some((review) => review.userId === sub),
		canMerge: live && merger && forkLabel !== null,
		canEdit: live && pr.authorId === sub,
	};
}

export async function toView(
	sub: string,
	pr: StoredPullRequest,
	source: CollectionAccess | null,
): Promise<PullRequestView> {
	return viewOf(sub, pr, source, await contextOf([pr]));
}

/** Pull requests into or out of the collection, newest first. */
export async function listPullRequests(
	sub: string,
	collectionId: string,
): Promise<PullRequestView[]> {
	const access = await requireCollection(sub, collectionId, "view");
	const rows = await PullRequestModel.find({
		$or: [{ sourceId: access.collectionId }, { forkId: access.collectionId }],
	})
		.sort({ createdAt: -1 })
		.limit(LISTED)
		.lean<StoredPullRequest[]>();
	const context = await contextOf(rows);
	// Pull requests out of a fork share one source: check it once.
	const sources = new Map<string, Promise<CollectionAccess | null>>();
	const sourceOf = (id: string) => {
		const known = sources.get(id);
		if (known) return known;
		const access = requireCollection(sub, id, "view").catch(() => null);
		sources.set(id, access);
		return access;
	};
	return Promise.all(
		rows.map(async (pr) => {
			const source = pr.sourceId.equals(access.collectionId)
				? access
				: await sourceOf(pr.sourceId.toHexString());
			return viewOf(sub, pr, source, context);
		}),
	);
}

export async function getPullRequest(
	sub: string,
	id: string,
): Promise<PullRequestDetail> {
	const { pr, source } = await requirePullRequest(sub, id);
	const [view, preview] = await Promise.all([
		toView(sub, pr, source),
		livePreview(sub, pr, source),
	]);
	return { ...view, preview };
}
