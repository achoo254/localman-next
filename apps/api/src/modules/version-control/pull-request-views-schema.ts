import {
	PULL_REQUEST_DESCRIPTION_MAX,
	PULL_REQUEST_REVIEWERS_MAX,
	PULL_REQUEST_TITLE_MAX,
} from "@localman/shared/api-client";
import { z } from "zod";
import { mergePreviewView } from "./fork-views-schema.js";

/** Inputs and output schemas of the pull request operations. */
export const PULL_REQUEST_PATH = "/pull-requests/:pullRequestId";
export const pullRequestIdSchema = z.string().min(1).max(64);
export const titleSchema = z.string().trim().min(1).max(PULL_REQUEST_TITLE_MAX);
export const descriptionSchema = z
	.string()
	.trim()
	.max(PULL_REQUEST_DESCRIPTION_MAX);
export const reviewerIdsSchema = z
	.array(z.string().min(1).max(128))
	.max(PULL_REQUEST_REVIEWERS_MAX);

export const pullRequestView = z.object({
	id: z.string(),
	sourceId: z.string(),
	sourceName: z.string().nullable(),
	forkId: z.string(),
	forkLabel: z.string().nullable(),
	title: z.string(),
	description: z.string(),
	authorId: z.string(),
	authorName: z.string().nullable(),
	reviewers: z.array(
		z.object({
			userId: z.string(),
			name: z.string().nullable(),
			decision: z.enum(["pending", "approved", "declined"]),
			at: z.string().nullable(),
		}),
	),
	status: z.enum(["open", "approved", "declined", "merged"]),
	mergedByName: z.string().nullable(),
	mergedAt: z.string().nullable(),
	createdAt: z.string(),
	canReview: z.boolean(),
	canMerge: z.boolean(),
	canEdit: z.boolean(),
});

export const pullRequestDetailView = pullRequestView.extend({
	preview: mergePreviewView.nullable(),
});

export const pullRequestListView = z.object({
	items: z.array(pullRequestView),
});

export const reviewerListView = z.object({
	items: z.array(
		z.object({
			userId: z.string(),
			username: z.string(),
			name: z.string().nullable(),
		}),
	),
});
