import {
	CONFLICT_SIDES,
	FORK_LABEL_MAX,
	MERGE_OPTIONS,
} from "@localman/shared/api-client";
import { z } from "zod";

/** Input and output schemas of the fork, pull and merge operations. */
export const labelSchema = z.string().trim().min(1).max(FORK_LABEL_MAX);
export const resolutionsSchema = z
	.record(z.string().max(200), z.enum(CONFLICT_SIDES))
	.default({});
export const mergeOptionSchema = z.enum(MERGE_OPTIONS).default("merge");

const entityKind = z.enum([
	"collection",
	"folder",
	"request",
	"example",
	"environment",
	"variable",
]);

export const forkStatusView = z.object({
	fork: z
		.object({
			label: z.string(),
			createdBy: z.string(),
			createdByName: z.string().nullable(),
			createdAt: z.string(),
			source: z.object({
				id: z.string(),
				name: z.string().nullable(),
				available: z.boolean(),
			}),
		})
		.nullable(),
	forkCount: z.number(),
});

export const forkListView = z.object({
	items: z.array(
		z.object({
			forkId: z.string(),
			label: z.string(),
			createdByName: z.string().nullable(),
			createdAt: z.string(),
			canOpen: z.boolean(),
		}),
	),
});

export const mergePreviewView = z.object({
	changes: z.array(
		z.object({
			key: z.string(),
			kind: z.enum(["added", "removed", "changed"]),
			entityKind,
			name: z.string(),
		}),
	),
	conflicts: z.array(
		z.object({
			id: z.string(),
			entityKind,
			name: z.string(),
			path: z.string(),
			base: z.unknown(),
			source: z.unknown(),
			destination: z.unknown(),
		}),
	),
});

export const syncDoneView = z.object({ done: z.literal(true) });
