import mongoose, { Schema, type Types } from "mongoose";
import { tenantScopePlugin } from "../../tenancy/tenant-scope-plugin.js";

export const PULL_REQUEST_STATUSES = [
	"open",
	"approved",
	"declined",
	"merged",
] as const;
export type PullRequestStatus = (typeof PULL_REQUEST_STATUSES)[number];

export const REVIEW_DECISIONS = ["pending", "approved", "declined"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * A request to merge a fork into its source collection. Its changes are
 * never stored: they are worked out from the fork, the source and their
 * base each time they are shown, like a merge preview. `status` follows the
 * reviews (any decline declines it, else any approval approves it) until it
 * is merged. Notices of the same reviewer and the open pull requests of a
 * source are capped.
 */
const pullRequestSchema = new Schema(
	{
		sourceId: { type: Schema.Types.ObjectId, required: true },
		forkId: { type: Schema.Types.ObjectId, required: true },
		title: { type: String, required: true },
		description: { type: String, default: "" },
		authorId: { type: String, required: true },
		reviewers: {
			type: [
				{
					userId: { type: String, required: true },
					decision: {
						type: String,
						enum: REVIEW_DECISIONS,
						default: "pending",
					},
					at: { type: Date, default: null },
					_id: false,
				},
			],
			default: [],
		},
		status: { type: String, enum: PULL_REQUEST_STATUSES, default: "open" },
		mergedBy: { type: String, default: null },
		mergedAt: { type: Date, default: null },
		/** Reviewers told it was opened, so asking one again tells nobody. */
		notified: { type: [String], default: [] },
		/** Bumped by every write: a write on a stale read misses and retries. */
		rev: { type: Number, default: 0 },
	},
	{ collection: "pull_requests", timestamps: true, versionKey: false },
);
pullRequestSchema.index({ sourceId: 1, createdAt: -1 });
pullRequestSchema.index({ sourceId: 1, status: 1 });
pullRequestSchema.index({ forkId: 1, createdAt: -1 });

pullRequestSchema.plugin(tenantScopePlugin);
export const PullRequestModel = mongoose.model(
	"PullRequest",
	pullRequestSchema,
);

export interface StoredReview {
	readonly userId: string;
	readonly decision: ReviewDecision;
	readonly at: Date | null;
}

export interface StoredPullRequest {
	readonly _id: Types.ObjectId;
	readonly sourceId: Types.ObjectId;
	readonly forkId: Types.ObjectId;
	readonly title: string;
	readonly description: string;
	readonly authorId: string;
	readonly reviewers: readonly StoredReview[];
	readonly status: PullRequestStatus;
	readonly mergedBy: string | null;
	readonly mergedAt: Date | null;
	readonly notified?: readonly string[];
	readonly rev?: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** The status the reviews give an unmerged pull request. */
export function statusOfReviews(
	reviews: readonly StoredReview[],
): PullRequestStatus {
	if (reviews.some((review) => review.decision === "declined"))
		return "declined";
	if (reviews.some((review) => review.decision === "approved"))
		return "approved";
	return "open";
}
