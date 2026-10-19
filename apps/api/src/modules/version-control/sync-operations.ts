import { type AnyOperation, defineOperation } from "@localman/operations";
import type {
	ConflictSide,
	ForkListItem,
	ForkStatus,
	MergeOption,
	MergePreview,
} from "@localman/shared/api-client";
import { z } from "zod";
import {
	USER_SCOPE,
	isAgentCall,
	requireSubject,
} from "../../http/require-auth.js";
import {
	forkListView,
	forkStatusView,
	labelSchema,
	mergeOptionSchema,
	mergePreviewView,
	resolutionsSchema,
} from "./fork-views-schema.js";
import type { MergeFollowUp } from "./merge-follow-up.js";
import { AGENT_PREVIEW, withholdPreviewSecrets } from "./merge-views.js";

/** What differs between forking a collection and an environment. */
export interface SyncKind {
	/** `Collection` or `Environment`, in operation ids. */
	readonly noun: "Collection" | "Environment";
	/** `/collections/:collectionId`, `/environments/:environmentId`. */
	readonly path: string;
	readonly param: "collectionId" | "environmentId";
	readonly note: string;
	status(sub: string, id: string): Promise<ForkStatus>;
	list(sub: string, id: string): Promise<ForkListItem[]>;
	relabel(sub: string, id: string, label: string): Promise<void>;
	preview(
		sub: string,
		id: string,
		direction: "pull" | "merge",
	): Promise<MergePreview>;
	pull(
		sub: string,
		id: string,
		resolutions: Record<string, ConflictSide>,
	): Promise<void>;
	merge(
		sub: string,
		id: string,
		option: MergeOption,
		resolutions: Record<string, ConflictSide>,
	): Promise<MergeFollowUp>;
}

const PRO = "Pro only (403 PLAN_FEATURE_UNAVAILABLE).";
const CONFLICTS =
	"`resolutions` maps each conflict id of the preview to `source` (keep the side the changes come from) or `destination` (keep the side being written); 409 MERGE_CONFLICTS while any lacks one. 404 FORK_NOT_FOUND when it is not a fork, FORK_SOURCE_UNAVAILABLE when its source is gone or out of reach.";

const readOnly = { readOnly: true, destructive: false, idempotent: true };
const write = { readOnly: false, destructive: false, idempotent: false };

/** Status, forks list, label, pull and merge of one kind of element. */
export function syncOperations(kind: SyncKind): AnyOperation[] {
	const { noun, path, param, note } = kind;
	const thing = `${noun === "Environment" ? "an" : "a"} ${noun.toLowerCase()}`;
	// Each input is one literal: named fields keep their own types beside
	// the computed id key.
	const id = z.string().min(1).max(64);
	const idInput = z.object({ [param]: id });
	const idOf = (input: Record<string, unknown>): string => String(input[param]);
	// The computed id key widens the inputs' field types: read the body
	// fields back through their own schemas.
	const pullBody = z.object({ resolutions: resolutionsSchema });
	const mergeBody = pullBody.extend({ option: mergeOptionSchema });
	const base = {
		scopes: [USER_SCOPE],
		toolset: "client" as const,
		mcp: true as const,
	};
	return [
		defineOperation({
			...base,
			id: `client.get${noun}ForkStatus`,
			method: "GET",
			path: `${path}/fork-status`,
			summary: `Whether ${thing} is a fork, and how many forks it has`,
			description: `\`fork\` holds its label, creator and source (named only when the caller can open it). ${note}`,
			input: idInput,
			output: forkStatusView,
			annotations: readOnly,
			handler: async (ctx, input) =>
				kind.status(requireSubject(ctx), idOf(input)),
		}),
		defineOperation({
			...base,
			id: `client.list${noun}Forks`,
			method: "GET",
			path: `${path}/forks`,
			summary: `List the forks of ${thing}`,
			description: `Newest first (at most 200), with whether the caller may open each. ${note}`,
			input: idInput,
			output: forkListView,
			annotations: readOnly,
			handler: async (ctx, input) => ({
				items: await kind.list(requireSubject(ctx), idOf(input)),
			}),
		}),
		defineOperation({
			...base,
			id: `client.relabel${noun}Fork`,
			method: "PATCH",
			path: `${path}/fork`,
			summary: "Rename a fork's label",
			description: `Editors of the fork. ${note}`,
			input: z.object({ [param]: id, label: labelSchema }),
			output: z.object({ label: z.string() }),
			annotations: { ...write, idempotent: true },
			handler: async (ctx, input) => {
				await kind.relabel(requireSubject(ctx), idOf(input), input.label);
				return { label: input.label };
			},
		}),
		...(["pull", "merge"] as const).map((direction) =>
			defineOperation({
				...base,
				id: `client.preview${noun}${direction === "pull" ? "Pull" : "Merge"}`,
				method: "GET",
				path: `${path}/${direction}`,
				summary:
					direction === "pull"
						? "Preview pulling the source's changes into a fork"
						: "Preview merging a fork's changes into its source",
				description: `What would change on the ${direction === "pull" ? "fork" : "source"} and the conflicts to choose for. ${direction === "pull" ? "Editors of the fork" : "Editors of the source"}. ${PRO} ${noun === "Collection" ? `${AGENT_PREVIEW} ` : ""}${note}`,
				input: idInput,
				output: mergePreviewView,
				annotations: readOnly,
				handler: async (ctx, input) => {
					const preview = await kind.preview(
						requireSubject(ctx),
						idOf(input),
						direction,
					);
					return isAgentCall(ctx) ? withholdPreviewSecrets(preview) : preview;
				},
			}),
		),
		defineOperation({
			...base,
			id: `client.pull${noun}Changes`,
			method: "POST",
			path: `${path}/pull`,
			summary: "Pull the source's changes into a fork",
			description: `Editors of the fork; recorded as one change. ${CONFLICTS} ${PRO} ${note}`,
			input: z.object({ [param]: id, resolutions: resolutionsSchema }),
			output: z.object({ done: z.boolean() }),
			annotations: write,
			handler: async (ctx, input) => {
				await kind.pull(
					requireSubject(ctx),
					idOf(input),
					pullBody.parse(input).resolutions,
				);
				return { done: true };
			},
		}),
		defineOperation({
			...base,
			id: `client.merge${noun}Fork`,
			method: "POST",
			path: `${path}/merge`,
			summary: "Merge a fork's changes into its source",
			description: `Editors of the source; \`option\` \`mergeAndUpdate\` (also pulls the merged source back into the fork) and \`mergeAndDelete\` (then deletes the fork${noun === "Collection" ? " to the trash" : " for good"}) need Editor on the fork too; \`followUp\` is \`failed\` when that step could not run after the merge was written (the merge stands). ${CONFLICTS} ${PRO} ${note}`,
			input: z.object({
				[param]: id,
				option: mergeOptionSchema,
				resolutions: resolutionsSchema,
			}),
			output: z.object({
				done: z.boolean(),
				followUp: z.enum(["none", "done", "failed"]),
			}),
			annotations: write,
			handler: async (ctx, input) => {
				const body = mergeBody.parse(input);
				const followUp = await kind.merge(
					requireSubject(ctx),
					idOf(input),
					body.option,
					body.resolutions,
				);
				return { done: true, followUp };
			},
		}),
	];
}
